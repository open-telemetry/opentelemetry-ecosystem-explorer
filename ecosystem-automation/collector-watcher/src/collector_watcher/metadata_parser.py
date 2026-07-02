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
"""Version-aware parser system for collector component metadata.yaml files.

The upstream schema lives at:
  https://github.com/open-telemetry/opentelemetry-collector/blob/main/cmd/mdatagen/metadata-schema.yaml

The upstream schema does not yet carry a file_format/schema_version field.
Until one is contributed upstream, all files are routed to MetadataParserV1
(the current schema shape). When a file_format field is added upstream, add
a new parser class, register it in MetadataParserFactory, and leave V1 untouched.

Adding a required output field to any parser requires re-extracting all
historical registry versions via: uv run collector-watcher --backfill
"""

import logging
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class BaseMetadataParser(ABC):
    """Base class for version-specific component metadata parsers."""

    @abstractmethod
    def parse(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """
        Parse and normalise a raw metadata dict into the canonical output shape.

        Args:
            raw: Parsed YAML content of a metadata.yaml file.

        Returns:
            Normalised metadata dict, or None if the input is empty/invalid.
        """

    @abstractmethod
    def get_schema_version(self) -> str:
        """Return the schema version string this parser handles."""


# ---------------------------------------------------------------------------
# V1 — current upstream schema (no file_format field present)
# ---------------------------------------------------------------------------


class MetadataParserV1(BaseMetadataParser):
    """Parser for the current collector metadata schema (pre-file_format era).

    Handles: type, display_name, description, status, attributes, metrics,
    resource_attributes.
    """

    def get_schema_version(self) -> str:
        return "v1"

    def parse(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        if not raw:
            return None

        parsed: dict[str, Any] = {}

        if "type" in raw:
            parsed["type"] = raw["type"]

        if "display_name" in raw:
            parsed["display_name"] = raw["display_name"]

        if "description" in raw:
            parsed["description"] = self._sanitize_description(raw["description"])

        if "status" in raw:
            parsed["status"] = self._parse_status(raw["status"])

        if "attributes" in raw:
            parsed["attributes"] = self._parse_attributes(raw["attributes"])

        if "metrics" in raw:
            parsed["metrics"] = self._parse_metrics(raw["metrics"])

        if "resource_attributes" in raw:
            parsed["resource_attributes"] = self._parse_attributes(raw["resource_attributes"])

        return parsed or None

    @staticmethod
    def _sanitize_description(description: str) -> str:
        """Normalise multi-line YAML descriptions to a single clean string."""
        if not description:
            return description
        cleaned = description.strip().replace("\n", " ")
        return re.sub(r"\s+", " ", cleaned)

    def _parse_status(self, status: dict[str, Any]) -> dict[str, Any]:
        parsed: dict[str, Any] = {}

        if "class" in status:
            parsed["class"] = status["class"]

        if "stability" in status:
            stability: dict[str, Any] = {}
            for level in sorted(status["stability"].keys()):
                signals = status["stability"][level]
                stability[level] = sorted(signals) if isinstance(signals, list) else signals
            parsed["stability"] = stability

        if "distributions" in status:
            dists = status["distributions"]
            parsed["distributions"] = sorted(dists) if isinstance(dists, list) else dists

        if "codeowners" in status:
            parsed["codeowners"] = status["codeowners"]

        if "unsupported_platforms" in status:
            platforms = status["unsupported_platforms"]
            parsed["unsupported_platforms"] = sorted(platforms) if isinstance(platforms, list) else platforms

        return parsed

    def _parse_attributes(self, attributes: dict[str, Any]) -> dict[str, Any]:
        if not attributes:
            return {}

        parsed: dict[str, Any] = {}
        for attr_name in sorted(attributes.keys()):
            attr = attributes[attr_name]
            if isinstance(attr, dict):
                parsed_attr: dict[str, Any] = {}
                if "description" in attr:
                    parsed_attr["description"] = self._sanitize_description(attr["description"])
                if "type" in attr:
                    parsed_attr["type"] = attr["type"]
                if "name_override" in attr:
                    parsed_attr["name_override"] = attr["name_override"]
                if "enum" in attr:
                    parsed_attr["enum"] = sorted(attr["enum"]) if isinstance(attr["enum"], list) else attr["enum"]
                parsed[attr_name] = parsed_attr
            else:
                parsed[attr_name] = attr

        return parsed

    def _parse_metrics(self, metrics: dict[str, Any]) -> dict[str, Any]:
        if not metrics:
            return {}

        parsed: dict[str, Any] = {}
        for metric_name in sorted(metrics.keys()):
            metric = metrics[metric_name]
            if isinstance(metric, dict):
                parsed_metric: dict[str, Any] = {}
                if "description" in metric:
                    parsed_metric["description"] = self._sanitize_description(metric["description"])
                if "unit" in metric:
                    parsed_metric["unit"] = metric["unit"]
                if "enabled" in metric:
                    parsed_metric["enabled"] = metric["enabled"]
                for metric_type in ["sum", "gauge", "histogram"]:
                    if metric_type in metric:
                        parsed_metric[metric_type] = metric[metric_type]
                if "attributes" in metric:
                    attrs = metric["attributes"]
                    parsed_metric["attributes"] = sorted(attrs) if isinstance(attrs, list) else attrs
                if "stability" in metric:
                    parsed_metric["stability"] = metric["stability"]
                parsed[metric_name] = parsed_metric
            else:
                parsed[metric_name] = metric

        return parsed


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


class MetadataParserFactory:
    """Routes metadata.yaml content to the correct version-specific parser.

    To add support for a new schema version:
    1. Create MetadataParserV2(BaseMetadataParser) with the new extraction logic.
    2. Register it: _parsers["v2"] = MetadataParserV2
    3. Do NOT modify MetadataParserV1.
    """

    _parsers: dict[str, type[BaseMetadataParser]] = {
        "v1": MetadataParserV1,
    }

    @classmethod
    def get_parser(cls, schema_version: str) -> BaseMetadataParser:
        """
        Return a parser for the given schema version.

        Args:
            schema_version: Version string, e.g. "v1".

        Raises:
            ValueError: If schema_version is not registered.
        """
        parser_class = cls._parsers.get(schema_version)
        if parser_class is None:
            supported = ", ".join(sorted(cls._parsers.keys()))
            raise ValueError(f"Unsupported schema_version: {schema_version!r}. Supported: {supported}")
        return parser_class()

    @classmethod
    def get_default_parser(cls) -> BaseMetadataParser:
        """Return the parser for the latest registered schema version."""
        latest = sorted(cls._parsers.keys(), key=lambda v: int(v[1:]))[-1]
        return cls._parsers[latest]()


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------


def parse_component_metadata(raw: dict[str, Any], schema_version: str | None = None) -> dict[str, Any] | None:
    """
    Parse a raw metadata.yaml dict using the appropriate version-specific parser.

    If schema_version is None, the default (latest) parser is used. Once the
    upstream collector schema gains a file_format field, callers should pass its
    value here so the factory can route correctly.

    Args:
        raw: Parsed YAML content of a metadata.yaml file.
        schema_version: Parser version to use, e.g. "v1". None = default.

    Returns:
        Normalised metadata dict, or None if the input is empty/unparseable.
    """
    if schema_version is not None:
        parser = MetadataParserFactory.get_parser(schema_version)
    else:
        parser = MetadataParserFactory.get_default_parser()
    return parser.parse(raw)


# ---------------------------------------------------------------------------
# File-I/O wrapper (backward-compatible entry point used by ComponentScanner)
# ---------------------------------------------------------------------------


class MetadataParser:
    """File-I/O wrapper around the versioned parser infrastructure.

    ComponentScanner uses this class unchanged: MetadataParser(path).parse().
    Internally it reads metadata.yaml, auto-detects schema_version from the
    file's own fields (once the upstream gains a file_format field), and
    delegates to parse_component_metadata().
    """

    def __init__(self, component_path: Path):
        self.component_path = Path(component_path)
        self.metadata_path = self.component_path / "metadata.yaml"

    def has_metadata(self) -> bool:
        return self.metadata_path.exists()

    def parse(self, schema_version: str | None = None) -> dict[str, Any] | None:
        """
        Read and parse metadata.yaml using the appropriate parser version.

        Args:
            schema_version: Override the parser version. If None, auto-detection
                is attempted from the file's schema_version / file_format field;
                if that field is absent the default parser is used.

        Returns:
            Normalised metadata dict, or None on failure.
        """
        if not self.has_metadata():
            return None

        try:
            with open(self.metadata_path, encoding="utf-8") as f:
                raw = yaml.safe_load(f)
        except yaml.YAMLError as e:
            logger.warning("Failed to parse %s: %s", self.metadata_path, e)
            return None

        try:
            if not raw:
                return None

            if schema_version is None:
                # Auto-detect from the file itself. The upstream schema does not yet
                # carry this field; the lookup is a no-op for now and will activate
                # transparently once the upstream adds file_format or schema_version.
                schema_version = raw.get("schema_version") or raw.get("file_format")

            return parse_component_metadata(raw, schema_version)

        except ValueError:
            # Propagate unsupported schema_version as a programming error, not a
            # data error.  The caller passed (or the file declared) a version string
            # that has no registered parser.
            raise
        except Exception as e:
            logger.warning("Unexpected error parsing %s: %s", self.metadata_path, e)
            return None
