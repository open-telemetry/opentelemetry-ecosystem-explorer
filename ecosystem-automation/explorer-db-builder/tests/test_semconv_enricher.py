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
        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry(temp_dir, self.sample_instrumentation, "1.37.0")

            # Check manifest.yaml
            with open(os.path.join(temp_dir, "manifest.yaml")) as f:
                manifest = yaml.safe_load(f)
                self.assertEqual(manifest["name"], "test-lib")
                self.assertEqual(manifest["dependencies"][0]["name"], "otel")
                self.assertIn("v1.37.0", manifest["dependencies"][0]["registry_path"])

            # Check telemetry.yaml
            with open(os.path.join(temp_dir, "telemetry.yaml")) as f:
                telemetry = yaml.safe_load(f)
                self.assertEqual(telemetry["file_format"], "definition/2")
                groups = telemetry["groups"]
                self.assertEqual(len(groups), 2)

                # Metric group
                metric_group = next(g for g in groups if g["type"] == "metric")
                self.assertEqual(metric_group["id"], "http.server.request.duration")
                self.assertEqual(metric_group["metrics"][0]["name"], "http.server.request.duration")
                self.assertEqual(metric_group["attributes"][0]["ref"], "http.request.method")

                # Span group
                span_group = next(g for g in groups if g["type"] == "span")
                self.assertEqual(span_group["id"], "test-lib.SERVER")
                self.assertEqual(span_group["span_kind"], "server")
                self.assertEqual(span_group["attributes"][0]["ref"], "http.request.method")

    @patch("subprocess.run")
    def test_run_weaver_check_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            self.enricher._prepare_weaver_registry(temp_dir, self.sample_instrumentation, "1.37.0")
            results = self.enricher._run_weaver_check(temp_dir)

            self.assertTrue(results["http.server.request.duration"])
            self.assertTrue(results["test-lib.SERVER"])

    @patch("subprocess.run")
    def test_run_weaver_check_failure(self, mock_run):
        # Simulate an error for the metric but not the span (simplified parser check)
        mock_run.return_value = MagicMock(
            returncode=1,
            stderr="[Error] signals/telemetry.yaml: http.server.request.duration attribute 'foo' not found",
        )

        import tempfile

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
