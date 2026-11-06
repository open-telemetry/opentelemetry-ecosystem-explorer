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

import json
import logging
import os
import re
import subprocess
import tempfile
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml

logger = logging.getLogger(__name__)


class SemconvEnricher:
    """Enriches instrumentation metadata with Semantic Convention compliance information using Weaver."""

    DEFAULT_SEMCONV_VERSION = "1.44.0"
    TARGET_WEAVER_VERSION = "0.26.1"

    def __init__(self, weaver_path: str = "weaver"):
        """Args:
        weaver_path: Path to the weaver executable.
        """
        self.weaver_path = weaver_path
        self._semconv_metrics_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def enrich_inventory(self, inventory_data: Dict[str, Any]) -> None:
        """Enriches an entire inventory in a single-shot batch per Semantic Convention version.

        Args:
            inventory_data: Transformed inventory data.
        """
        all_instrumentations = []
        for key in ["libraries", "custom"]:
            if key in inventory_data and inventory_data[key]:
                all_instrumentations.extend(inventory_data[key])

        if not all_instrumentations:
            return

        by_version: Dict[str, List[Dict[str, Any]]] = {}
        for inst in all_instrumentations:
            if not inst.get("telemetry"):
                continue
            schema_url = inst.get("scope", {}).get("schema_url", "")
            version = self._extract_version(schema_url) or self.DEFAULT_SEMCONV_VERSION
            by_version.setdefault(version, []).append(inst)

        for version, insts in by_version.items():
            logger.info(
                f"Running semconv compliance check for {len(insts)} instrumentations using Weaver "
                f"(version {version})..."
            )
            semconv_metrics = self._get_semconv_metrics(version)
            with tempfile.TemporaryDirectory() as temp_dir:
                group_mappings = self._prepare_weaver_registry_batch(temp_dir, insts, version)
                try:
                    unresolved_attrs = self._run_weaver_check(temp_dir)
                    self._apply_compliance_metadata_batch(
                        insts, group_mappings, unresolved_attrs, semconv_metrics, version
                    )
                except Exception as e:
                    logger.warning(f"Failed to run semconv compliance check for version {version}: {e}")

    def _extract_version(self, schema_url: str) -> Optional[str]:
        """Extracts the version from an OpenTelemetry schema URL."""
        if not schema_url:
            return None
        match = re.search(r"/schemas/(\d+\.\d+\.\d+)", schema_url)
        return match.group(1) if match else None

    def _get_semconv_metrics(self, version: str) -> Dict[str, Dict[str, Any]]:
        """Resolves official semconv metrics for the specified version using Weaver."""
        if version in self._semconv_metrics_cache:
            return self._semconv_metrics_cache[version]

        cmd = [
            self.weaver_path,
            "registry",
            "resolve",
            "-r",
            f"https://github.com/open-telemetry/semantic-conventions@v{version}[model]",
            "-f",
            "json",
            "--skip-policies",
        ]
        metrics: Dict[str, Dict[str, Any]] = {}
        try:
            result = subprocess.run(  # noqa: S603
                cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60
            )
            if result.returncode == 0 and result.stdout:
                data = json.loads(result.stdout)
                for g in data.get("groups", []):
                    if g.get("type") == "metric":
                        name = g.get("metric_name") or g.get("id", "").replace("metric.", "")
                        metrics[name] = {
                            "instrument": (g.get("instrument") or "").lower(),
                            "unit": g.get("unit") or "",
                        }
        except Exception as e:
            logger.warning(f"Could not resolve official semconv metrics for version {version}: {e}")

        self._semconv_metrics_cache[version] = metrics
        return metrics

    def _prepare_weaver_registry_batch(
        self, registry_dir: str, instrumentations: List[Dict[str, Any]], version: str
    ) -> Dict[str, Any]:
        """Prepares a Weaver-compatible registry directory for a batch of instrumentations.

        Returns a mapping of group_id to the underlying metric/span dictionary.
        """
        manifest = {
            "name": "semconv-batch-check",
            "schema_url": "https://explorer.opentelemetry.io/schemas/batch-check",
            "dependencies": [
                {
                    "name": "otel",
                    "schema_url": f"https://opentelemetry.io/schemas/{version}",
                    "registry_path": f"https://github.com/open-telemetry/semantic-conventions@v{version}[model]",
                }
            ],
        }
        with open(os.path.join(registry_dir, "manifest.yaml"), "w", encoding="utf-8") as f:
            yaml.dump(manifest, f)

        groups = []
        group_mappings: Dict[str, Any] = {}

        for inst in instrumentations:
            inst_name = inst.get("name", "unknown")
            for entry_idx, entry in enumerate(inst.get("telemetry", [])):
                for metric_idx, metric in enumerate(entry.get("metrics") or []):
                    metric_name = metric.get("name")
                    group_id = f"{inst_name}.m_{entry_idx}_{metric_idx}"
                    group_mappings[group_id] = {"kind": "metric", "data": metric}
                    groups.append(
                        {
                            "id": group_id,
                            "type": "metric",
                            "metric_name": metric_name,
                            "brief": metric.get("description") or f"Metric {metric_name}",
                            "instrument": (metric.get("instrument") or "histogram").lower(),
                            "unit": metric.get("unit") or "1",
                            "stability": "stable",
                            "attributes": [
                                {"ref": a.get("name")} for a in metric.get("attributes") or [] if a.get("name")
                            ],
                        }
                    )

                for span_idx, span in enumerate(entry.get("spans") or []):
                    span_kind = (span.get("span_kind") or "SERVER").lower()
                    group_id = f"{inst_name}.s_{entry_idx}_{span_idx}"
                    group_mappings[group_id] = {"kind": "span", "data": span}
                    groups.append(
                        {
                            "id": group_id,
                            "type": "span",
                            "brief": f"Span for {inst_name}",
                            "span_kind": span_kind,
                            "stability": "stable",
                            "attributes": [
                                {"ref": a.get("name")} for a in span.get("attributes") or [] if a.get("name")
                            ],
                        }
                    )

        if groups:
            with open(os.path.join(registry_dir, "telemetry.yaml"), "w", encoding="utf-8") as f:
                yaml.dump({"groups": groups}, f)

        return group_mappings

    def _run_weaver_check(self, registry_dir: str) -> Set[Tuple[str, str]]:
        """Runs weaver registry check and returns a set of (group_id, attribute_ref) that failed."""
        cmd = [self.weaver_path, "registry", "check", "-r", registry_dir, "--diagnostic-format", "json"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=60)  # noqa: S603
        except subprocess.TimeoutExpired:
            logger.warning(
                f"Weaver registry check timed out after 60 seconds for {registry_dir}; skipping semconv enrichment."
            )
            return set()

        unresolved_attrs: Set[Tuple[str, str]] = set()

        output_text = f"{result.stdout or ''}\n{result.stderr or ''}"
        diag_start = output_text.find("[")
        if diag_start != -1:
            try:
                diags, _ = json.JSONDecoder().raw_decode(output_text[diag_start:])
                for d in diags:
                    compound = d.get("error", {}).get("Resolver", {}).get("CompoundError", [])
                    for c in compound:
                        if "UnresolvedAttributeRef" in c:
                            info = c["UnresolvedAttributeRef"]
                            gid = info.get("group_id")
                            aref = info.get("attribute_ref")
                            if gid and aref:
                                unresolved_attrs.add((gid, aref))
            except Exception as e:
                logger.debug(f"Failed to parse Weaver JSON diagnostics: {e}")

        return unresolved_attrs

    def _apply_compliance_metadata_batch(
        self,
        instrumentations: List[Dict[str, Any]],
        group_mappings: Dict[str, Any],
        unresolved_attrs: Set[Tuple[str, str]],
        semconv_metrics: Dict[str, Dict[str, Any]],
        version: str,
    ) -> None:
        """Applies batch compliance results back to individual instrumentation data."""
        for gid, mapping in group_mappings.items():
            kind = mapping["kind"]
            item = mapping["data"]

            attrs = item.get("attributes") or []
            item_attrs_valid = True if attrs else False

            for attr in attrs:
                aname = attr.get("name")
                if not aname:
                    continue
                if (gid, aname) not in unresolved_attrs:
                    if version not in attr.setdefault("semconv_compliance", []):
                        attr["semconv_compliance"].append(version)
                else:
                    item_attrs_valid = False

            if kind == "metric":
                mname = item.get("name")
                minst = (item.get("instrument") or "").lower()
                # A metric is compliant if defined in semconv with matching instrument and attributes are valid
                if mname in semconv_metrics:
                    sc_metric = semconv_metrics[mname]
                    if minst == sc_metric["instrument"] and (not attrs or item_attrs_valid):
                        if version not in item.setdefault("semconv_compliance", []):
                            item["semconv_compliance"].append(version)
            elif kind == "span":
                # A span is compliant if it defines attributes and all resolve against semconv
                if attrs and item_attrs_valid:
                    if version not in item.setdefault("semconv_compliance", []):
                        item["semconv_compliance"].append(version)
