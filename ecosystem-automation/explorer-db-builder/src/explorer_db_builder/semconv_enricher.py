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
"""Enriches instrumentation metadata with Semantic Convention compliance information."""

import logging
import os
import re
import subprocess
import tempfile
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)


class SemconvEnricher:
    """Enriches instrumentation metadata with Semantic Convention compliance information using Weaver."""

    def __init__(self, weaver_path: str = "weaver"):
        """
        Args:
            weaver_path: Path to the weaver executable.
        """
        self.weaver_path = weaver_path

    def enrich_inventory(self, inventory_data: Dict[str, Any]) -> None:
        """Enriches an entire inventory (libraries and custom instrumentations).

        Args:
            inventory_data: Transformed inventory data.
        """
        for key in ["libraries", "custom"]:
            if key in inventory_data and inventory_data[key]:
                for instrumentation in inventory_data[key]:
                    self.enrich_instrumentation(instrumentation)

    def enrich_instrumentation(self, instrumentation: Dict[str, Any]) -> None:
        """Enriches a single instrumentation with semconv compliance metadata.

        Args:
            instrumentation: Instrumentation data dictionary.
        """
        telemetry_entries = instrumentation.get("telemetry", [])
        if not telemetry_entries:
            return

        # POC: For now, we only support a single semconv version per instrumentation based on its schema_url
        schema_url = instrumentation.get("scope", {}).get("schema_url", "")
        version = self._extract_version(schema_url) or "1.37.0"

        # Create temporary registry for Weaver
        with tempfile.TemporaryDirectory() as temp_dir:
            self._prepare_weaver_registry(temp_dir, instrumentation, version)

            # Run Weaver and parse results
            try:
                compliance_results = self._run_weaver_check(temp_dir)
                self._apply_compliance_metadata(instrumentation, compliance_results, version)
            except Exception as e:
                logger.warning(f"Failed to run semconv compliance check for {instrumentation.get('name')}: {e}")

    def _extract_version(self, schema_url: str) -> Optional[str]:
        """Extracts the version from an OpenTelemetry schema URL."""
        if not schema_url:
            return None
        # Format: https://opentelemetry.io/schemas/1.37.0
        match = re.search(r"/schemas/(\d+\.\d+\.\d+)", schema_url)
        return match.group(1) if match else None

    def _prepare_weaver_registry(self, registry_dir: str, instrumentation: Dict[str, Any], version: str) -> None:
        """Prepares a Weaver-compatible registry directory.

        Args:
            registry_dir: Temporary directory to create the registry in.
            instrumentation: Instrumentation data.
            version: Semantic Convention version to check against.
        """
        # manifest.yaml
        manifest = {
            "name": instrumentation.get("name", "check"),
            "schema_url": instrumentation.get("scope", {}).get(
                "schema_url", f"https://opentelemetry.io/schemas/{version}"
            ),
            "dependencies": [
                {
                    "name": "otel",
                    "registry_path": f"https://github.com/open-telemetry/semantic-conventions@v{version}",
                }
            ],
        }
        with open(os.path.join(registry_dir, "manifest.yaml"), "w") as f:
            yaml.dump(manifest, f)

        # telemetry.yaml
        groups = []
        telemetry_entries = instrumentation.get("telemetry", [])
        for entry in telemetry_entries:
            # Metrics
            for metric in entry.get("metrics", []):
                metric_name = metric.get("name")
                group = {
                    "id": metric_name,
                    "type": "metric",
                    "attributes": [{"ref": attr.get("name")} for attr in metric.get("attributes", [])],
                    "metrics": [
                        {
                            "name": metric_name,
                            "brief": metric.get("description", "POC metric"),
                            "instrument": metric.get("instrument", "histogram"),
                            "unit": metric.get("unit", "s"),
                        }
                    ],
                }
                groups.append(group)

            # Spans
            for span in entry.get("spans", []):
                # Use a synthetic ID for the span group if name is missing
                span_id = f"{instrumentation.get('name')}.{span.get('span_kind', 'unknown')}"
                group = {
                    "id": span_id,
                    "type": "span",
                    "brief": "POC span",
                    "span_kind": span.get("span_kind", "SERVER").lower(),
                    "attributes": [{"ref": attr.get("name")} for attr in span.get("attributes", [])],
                }
                groups.append(group)

        if groups:
            telemetry_data = {"file_format": "definition/2", "groups": groups}
            with open(os.path.join(registry_dir, "telemetry.yaml"), "w") as f:
                yaml.dump(telemetry_data, f)

    def _run_weaver_check(self, registry_dir: str) -> Dict[str, bool]:
        """Runs weaver registry check and returns a map of signal ID to compliance status.

        Args:
            registry_dir: Path to the Weaver registry.

        Returns:
            Dict mapping signal IDs to a boolean (True if compliant).
        """
        # In a real environment, this would call 'weaver registry check -r <registry_dir>'
        # For this POC, we'll implement the subprocess call and handle the output.
        # If weaver is not found, it will raise an exception which is caught in enrich_instrumentation.

        cmd = [self.weaver_path, "registry", "check", "-r", registry_dir]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            logger.warning(
                f"Weaver registry check timed out after 60 seconds for {registry_dir}; "
                "skipping semconv enrichment for this instrumentation."
            )
            return {}

        compliance_map = {}

        # Initially assume all are compliant if Weaver succeeded
        # We need to know which signals we defined to populate the map.
        # We'll read them back from the generated yaml.
        try:
            with open(os.path.join(registry_dir, "telemetry.yaml")) as f:
                telemetry_data = yaml.safe_load(f)
                for group in telemetry_data.get("groups", []):
                    compliance_map[group["id"]] = result.returncode == 0
        except Exception as e:
            logger.error(f"Failed to read telemetry.yaml from {registry_dir}: {e}")
            return {}

        if result.returncode != 0:
            # Parse errors to mark specific signals as non-compliant
            # Example error line: [Error] groups[0].attributes[1]: attribute 'foo' not found in registry
            # This is complex to parse robustly without a stable Weaver output format.
            # For the POC, if Weaver fails, we mark everything as non-compliant or log it.
            logger.debug(f"Weaver reported errors (exit code {result.returncode}):\n{result.stderr}")

            # Simple heuristic: if an ID appears in an error line, mark it as non-compliant
            for signal_id in compliance_map.keys():
                if signal_id in result.stderr:
                    compliance_map[signal_id] = False

        return compliance_map

    def _apply_compliance_metadata(
        self, instrumentation: Dict[str, Any], results: Dict[str, bool], version: str
    ) -> None:
        """Applies compliance results back to the instrumentation data.

        Args:
            instrumentation: The instrumentation dict to modify.
            results: Map of signal ID to compliance status.
            version: The semconv version checked.
        """
        telemetry_entries = instrumentation.get("telemetry", [])
        for entry in telemetry_entries:
            for metric in entry.get("metrics", []):
                if results.get(metric.get("name"), False):
                    metric.setdefault("semconv_compliance", []).append(version)

            for span in entry.get("spans", []):
                span_id = f"{instrumentation.get('name')}.{span.get('span_kind', 'unknown')}"
                if results.get(span_id, False):
                    span.setdefault("semconv_compliance", []).append(version)
