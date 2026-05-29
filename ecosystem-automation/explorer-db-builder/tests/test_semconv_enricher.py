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
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import yaml
from explorer_db_builder.semconv_enricher import SemconvEnricher


class TestSemconvEnricher(unittest.TestCase):
    def setUp(self):
        self.enricher = SemconvEnricher()
        self.sample_instrumentation = {
            "name": "test-lib",
            "scope": {"schema_url": "https://opentelemetry.io/schemas/1.37.0"},
            "telemetry": [
                {
                    "metrics": [
                        {
                            "name": "http.server.request.duration",
                            "attributes": [{"name": "http.request.method"}],
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

    def test_extract_version(self):
        self.assertEqual(self.enricher._extract_version("https://opentelemetry.io/schemas/1.37.0"), "1.37.0")
        self.assertEqual(self.enricher._extract_version("invalid-url"), None)
        self.assertEqual(self.enricher._extract_version(""), None)

    def test_prepare_weaver_registry(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry(temp_dir, self.sample_instrumentation, "1.37.0")

            with open(os.path.join(temp_dir, "manifest.yaml")) as f:
                manifest = yaml.safe_load(f)
                self.assertEqual(manifest["name"], "test-lib")
                self.assertEqual(manifest["dependencies"][0]["name"], "otel")
                self.assertIn("v1.37.0", manifest["dependencies"][0]["registry_path"])

            with open(os.path.join(temp_dir, "telemetry.yaml")) as f:
                telemetry = yaml.safe_load(f)
                self.assertEqual(telemetry["file_format"], "definition/2")
                groups = telemetry["groups"]
                self.assertEqual(len(groups), 2)

                metric_group = next(g for g in groups if g["type"] == "metric")
                self.assertEqual(metric_group["id"], "http.server.request.duration")
                self.assertEqual(metric_group["metrics"][0]["name"], "http.server.request.duration")
                self.assertEqual(metric_group["attributes"][0]["ref"], "http.request.method")

                span_group = next(g for g in groups if g["type"] == "span")
                self.assertEqual(span_group["id"], "test-lib.SERVER")
                self.assertEqual(span_group["span_kind"], "server")
                self.assertEqual(span_group["attributes"][0]["ref"], "http.request.method")

    def test_prepare_weaver_registry_batch(self):
        inst1 = {
            "name": "lib-one",
            "scope": {"schema_url": "https://opentelemetry.io/schemas/1.37.0"},
            "telemetry": [
                {
                    "metrics": [{"name": "metric.one", "attributes": [{"name": "attr.a"}]}],
                    "spans": [{"span_kind": "SERVER", "attributes": [{"name": "attr.b"}]}],
                }
            ],
        }
        inst2 = {
            "name": "lib-two",
            "scope": {"schema_url": "https://opentelemetry.io/schemas/1.37.0"},
            "telemetry": [
                {
                    "metrics": [{"name": "metric.two", "attributes": [{"name": "attr.c"}]}],
                    "spans": [{"span_kind": "CLIENT", "attributes": [{"name": "attr.d"}]}],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry_batch(temp_dir, [inst1, inst2], "1.37.0")

            with open(os.path.join(temp_dir, "manifest.yaml")) as f:
                manifest = yaml.safe_load(f)
                self.assertEqual(manifest["name"], "semconv-batch-check")
                self.assertEqual(manifest["dependencies"][0]["name"], "otel")

            with open(os.path.join(temp_dir, "telemetry.yaml")) as f:
                telemetry = yaml.safe_load(f)
                self.assertEqual(telemetry["file_format"], "definition/2")
                groups = telemetry["groups"]
                self.assertEqual(len(groups), 4)

                m1 = next(g for g in groups if g["id"] == "lib-one.metric.one")
                self.assertEqual(m1["type"], "metric")
                self.assertEqual(m1["metrics"][0]["name"], "metric.one")
                self.assertEqual(m1["attributes"][0]["ref"], "attr.a")

                s1 = next(g for g in groups if g["id"] == "lib-one.SERVER")
                self.assertEqual(s1["type"], "span")
                self.assertEqual(s1["span_kind"], "server")
                self.assertEqual(s1["attributes"][0]["ref"], "attr.b")

                m2 = next(g for g in groups if g["id"] == "lib-two.metric.two")
                self.assertEqual(m2["type"], "metric")
                self.assertEqual(m2["metrics"][0]["name"], "metric.two")
                self.assertEqual(m2["attributes"][0]["ref"], "attr.c")

                s2 = next(g for g in groups if g["id"] == "lib-two.CLIENT")
                self.assertEqual(s2["type"], "span")
                self.assertEqual(s2["span_kind"], "client")
                self.assertEqual(s2["attributes"][0]["ref"], "attr.d")

    @patch("subprocess.run")
    def test_run_weaver_check_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry(temp_dir, self.sample_instrumentation, "1.37.0")
            results = self.enricher._run_weaver_check(temp_dir)

            self.assertTrue(results["http.server.request.duration"])
            self.assertTrue(results["test-lib.SERVER"])

    @patch("subprocess.run")
    def test_run_weaver_check_failure(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=1,
            stderr="[Error] signals/telemetry.yaml: http.server.request.duration attribute 'foo' not found",
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry(temp_dir, self.sample_instrumentation, "1.37.0")
            results = self.enricher._run_weaver_check(temp_dir)

            self.assertFalse(results["http.server.request.duration"])
            self.assertFalse(results["test-lib.SERVER"])

    @patch.object(SemconvEnricher, "_run_weaver_check")
    def test_enrich_instrumentation(self, mock_check):
        mock_check.return_value = {"http.server.request.duration": True, "test-lib.SERVER": False}

        self.enricher.enrich_instrumentation(self.sample_instrumentation)

        metric = self.sample_instrumentation["telemetry"][0]["metrics"][0]
        self.assertEqual(metric["semconv_compliance"], ["1.37.0"])

        span = self.sample_instrumentation["telemetry"][0]["spans"][0]
        self.assertNotIn("semconv_compliance", span)

    def test_enrich_instrumentation_no_telemetry(self):
        instrumentation = {"name": "empty"}
        self.enricher.enrich_instrumentation(instrumentation)
        self.assertEqual(instrumentation, {"name": "empty"})

    @patch.object(SemconvEnricher, "_run_weaver_check")
    def test_enrich_inventory_batch(self, mock_check):
        mock_check.return_value = {
            "lib-one.metric.one": True,
            "lib-one.SERVER": False,
            "lib-two.metric.two": True,
            "lib-two.CLIENT": True,
        }

        inventory = {
            "libraries": [
                {
                    "name": "lib-one",
                    "scope": {"schema_url": "https://opentelemetry.io/schemas/1.37.0"},
                    "telemetry": [
                        {
                            "metrics": [{"name": "metric.one"}],
                            "spans": [{"span_kind": "SERVER"}],
                        }
                    ],
                }
            ],
            "custom": [
                {
                    "name": "lib-two",
                    "scope": {"schema_url": "https://opentelemetry.io/schemas/1.37.0"},
                    "telemetry": [
                        {
                            "metrics": [{"name": "metric.two"}],
                            "spans": [{"span_kind": "CLIENT"}],
                        }
                    ],
                }
            ],
        }

        self.enricher.enrich_inventory(inventory)

        # lib-one.metric.one is True
        self.assertEqual(inventory["libraries"][0]["telemetry"][0]["metrics"][0]["semconv_compliance"], ["1.37.0"])
        # lib-one.SERVER is False
        self.assertNotIn("semconv_compliance", inventory["libraries"][0]["telemetry"][0]["spans"][0])

        # lib-two.metric.two is True
        self.assertEqual(inventory["custom"][0]["telemetry"][0]["metrics"][0]["semconv_compliance"], ["1.37.0"])
        # lib-two.CLIENT is True
        self.assertEqual(inventory["custom"][0]["telemetry"][0]["spans"][0]["semconv_compliance"], ["1.37.0"])
