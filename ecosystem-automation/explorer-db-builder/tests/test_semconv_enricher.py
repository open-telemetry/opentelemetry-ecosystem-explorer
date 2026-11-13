# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""Tests for SemconvEnricher."""

import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import yaml
from explorer_db_builder.semconv_enricher import SemconvEnricher


class TestSemconvEnricher(unittest.TestCase):
    def setUp(self):
        self.enricher = SemconvEnricher()
        self.sample_inventory = {
            "libraries": [
                {
                    "name": "test-lib",
                    "scope": {"schema_url": "https://opentelemetry.io/schemas/1.44.0"},
                    "telemetry": [
                        {
                            "metrics": [
                                {
                                    "name": "http.server.request.duration",
                                    "instrument": "histogram",
                                    "unit": "s",
                                    "attributes": [{"name": "http.request.method"}, {"name": "invalid.attr"}],
                                }
                            ],
                            "spans": [
                                {
                                    "span_kind": "SERVER",
                                    "attributes": [{"name": "http.request.method"}],
                                }
                            ],
                        }
                    ],
                }
            ]
        }

    def test_extract_version(self):
        self.assertEqual(self.enricher._extract_version("https://opentelemetry.io/schemas/1.44.0"), "1.44.0")
        self.assertEqual(self.enricher._extract_version("https://opentelemetry.io/schemas/1.37.0"), "1.37.0")
        self.assertIsNone(self.enricher._extract_version("invalid-url"))
        self.assertIsNone(self.enricher._extract_version(""))
        self.assertIsNone(self.enricher._extract_version(None))

    def test_prepare_weaver_registry_batch(self):
        inst1 = {
            "name": "lib-one",
            "scope": {"schema_url": "https://opentelemetry.io/schemas/1.44.0"},
            "telemetry": [
                {
                    "metrics": [
                        {
                            "name": "http.server.request.duration",
                            "instrument": "histogram",
                            "attributes": [{"name": "attr.a"}],
                        }
                    ],
                    "spans": [{"span_kind": "SERVER", "attributes": [{"name": "attr.b"}]}],
                },
                {
                    # Second telemetry entry for same library (e.g. different when condition)
                    "metrics": [
                        {
                            "name": "http.server.request.duration",
                            "instrument": "histogram",
                            "attributes": [{"name": "attr.a"}],
                        }
                    ],
                    "spans": [{"span_kind": "SERVER", "attributes": [{"name": "attr.b"}]}],
                },
            ],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            mappings = self.enricher._prepare_weaver_registry_batch(temp_dir, [inst1], "1.44.0")

            with open(os.path.join(temp_dir, "manifest.yaml"), encoding="utf-8") as f:
                manifest = yaml.safe_load(f)
                self.assertEqual(manifest["name"], "semconv-batch-check")
                self.assertEqual(manifest["schema_url"], "https://explorer.opentelemetry.io/schemas/batch-check")
                dep = manifest["dependencies"][0]
                self.assertEqual(dep["name"], "otel")
                self.assertEqual(dep["schema_url"], "https://opentelemetry.io/schemas/1.44.0")
                self.assertIn("v1.44.0[model]", dep["registry_path"])

            with open(os.path.join(temp_dir, "telemetry.yaml"), encoding="utf-8") as f:
                telemetry = yaml.safe_load(f)
                self.assertNotIn("file_format", telemetry)
                groups = telemetry["groups"]
                # 2 metrics + 2 spans = 4 groups
                self.assertEqual(len(groups), 4)

                # Ensure all group IDs are unique
                group_ids = [g["id"] for g in groups]
                self.assertEqual(len(group_ids), len(set(group_ids)))

                # Ensure brief and stability are present
                for g in groups:
                    self.assertTrue(len(g.get("brief", "")) > 0)
                    self.assertEqual(g.get("stability"), "stable")

                self.assertEqual(len(mappings), 4)

    @patch("subprocess.run")
    def test_run_weaver_check_json_diagnostics(self, mock_run):
        stderr_json = json.dumps(
            [
                {
                    "diagnostic": {"message": "Unresolved attribute"},
                    "error": {
                        "Resolver": {
                            "CompoundError": [
                                {
                                    "UnresolvedAttributeRef": {
                                        "group_id": "test-lib.m_0_0",
                                        "attribute_ref": "invalid.attr",
                                    }
                                }
                            ]
                        }
                    },
                }
            ]
        )
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr=stderr_json)

        with tempfile.TemporaryDirectory() as temp_dir:
            unresolved = self.enricher._run_weaver_check(temp_dir)
            self.assertIn(("test-lib.m_0_0", "invalid.attr"), unresolved)

    @patch("subprocess.run")
    def test_run_weaver_check_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        with tempfile.TemporaryDirectory() as temp_dir:
            unresolved = self.enricher._run_weaver_check(temp_dir)
            self.assertEqual(len(unresolved), 0)

    @patch.object(SemconvEnricher, "_get_semconv_metrics")
    @patch.object(SemconvEnricher, "_run_weaver_check")
    def test_enrich_inventory_batch(self, mock_check, mock_metrics):
        # semconv defines http.server.request.duration as histogram
        mock_metrics.return_value = {"http.server.request.duration": {"instrument": "histogram", "unit": "s"}}
        # invalid.attr failed in group test-lib.m_0_0
        mock_check.return_value = {("test-lib.m_0_0", "invalid.attr")}

        self.enricher.enrich_inventory(self.sample_inventory)

        lib = self.sample_inventory["libraries"][0]
        metric = lib["telemetry"][0]["metrics"][0]
        span = lib["telemetry"][0]["spans"][0]

        # Valid attribute got compliance tag
        valid_attr = next(a for a in metric["attributes"] if a["name"] == "http.request.method")
        self.assertEqual(valid_attr["semconv_compliance"], ["1.44.0"])

        # Invalid attribute did not get compliance tag
        invalid_attr = next(a for a in metric["attributes"] if a["name"] == "invalid.attr")
        self.assertNotIn("semconv_compliance", invalid_attr)

        # Metric had an invalid attribute, so it is not marked fully compliant
        self.assertNotIn("semconv_compliance", metric)

        # Span attributes and span are compliant
        span_attr = span["attributes"][0]
        self.assertEqual(span_attr["semconv_compliance"], ["1.44.0"])
        self.assertEqual(span["semconv_compliance"], ["1.44.0"])

    @patch.object(SemconvEnricher, "_get_semconv_metrics")
    @patch.object(SemconvEnricher, "_run_weaver_check")
    def test_enrich_inventory_custom_metric_not_compliant(self, mock_check, mock_metrics):
        # Official registry does NOT define custom.metric
        mock_metrics.return_value = {}
        mock_check.return_value = set()

        inv = {
            "libraries": [
                {
                    "name": "custom-lib",
                    "telemetry": [
                        {
                            "metrics": [
                                {
                                    "name": "custom.metric",
                                    "instrument": "histogram",
                                    "attributes": [{"name": "http.request.method"}],
                                }
                            ]
                        }
                    ],
                }
            ]
        }
        self.enricher.enrich_inventory(inv)

        metric = inv["libraries"][0]["telemetry"][0]["metrics"][0]
        # Custom metric itself is NOT marked compliant with semconv
        self.assertNotIn("semconv_compliance", metric)
        # But its attribute which is in semconv is marked compliant
        self.assertEqual(metric["attributes"][0]["semconv_compliance"], ["1.44.0"])
