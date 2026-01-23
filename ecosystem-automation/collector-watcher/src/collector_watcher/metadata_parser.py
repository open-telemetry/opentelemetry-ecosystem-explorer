"""Parses metadata.yaml files from collector components.

See full schema:
 https://github.com/open-telemetry/opentelemetry-collector/blob/main/cmd/mdatagen/metadata-schema.yaml
"""

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class MetadataParser:
    def __init__(self, component_path: Path):
        """
        Args:
            component_path: Path to the component directory
        """
        self.component_path = Path(component_path)
        self.metadata_path = self.component_path / "metadata.yaml"

    def has_metadata(self) -> bool:
        """
        Check if metadata.yaml exists.

        Returns:
            True if metadata.yaml exists
        """
        return self.metadata_path.exists()

    def parse(self) -> dict[str, Any] | None:
        """
        Parse the metadata.yaml file.

        Returns:
            Parsed metadata dictionary, or None if file doesn't exist or is invalid
        """
        if not self.has_metadata():
            return None

        try:
            with open(self.metadata_path) as f:
                raw_metadata = yaml.safe_load(f)

            if not raw_metadata:
                return None

            parsed = {}

            if "type" in raw_metadata:
                parsed["type"] = raw_metadata["type"]

            if "display_name" in raw_metadata:
                parsed["display_name"] = raw_metadata["display_name"]

            if "description" in raw_metadata:
                parsed["description"] = raw_metadata["description"]

            # Status field (with nested structure)
            if "status" in raw_metadata:
                parsed["status"] = self._parse_status(raw_metadata["status"])

            # Attributes (sorted by key)
            if "attributes" in raw_metadata:
                parsed["attributes"] = self._parse_attributes(raw_metadata["attributes"])

            # Metrics (sorted by key)
            if "metrics" in raw_metadata:
                parsed["metrics"] = self._parse_metrics(raw_metadata["metrics"])

            # Resource attributes (sorted by key)
            if "resource_attributes" in raw_metadata:
                parsed["resource_attributes"] = self._parse_attributes(raw_metadata["resource_attributes"])

            return parsed

        except yaml.YAMLError as e:
            logger.warning("Failed to parse %s: %s", self.metadata_path, e)
            return None
        except Exception as e:
            logger.warning("Unexpected error parsing %s: %s", self.metadata_path, e)
            return None

    def _parse_status(self, status: dict[str, Any]) -> dict[str, Any]:
        """
        Parse the status section with deterministic ordering.

        Args:
            status: Raw status dictionary

        Returns:
            Parsed status dictionary
        """
        parsed = {}

        if "class" in status:
            parsed["class"] = status["class"]

        if "stability" in status:
            stability = {}
            for level in sorted(status["stability"].keys()):
                signals = status["stability"][level]
                if isinstance(signals, list):
                    stability[level] = sorted(signals)
                else:
                    stability[level] = signals
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
        """
        Parse attributes with deterministic ordering.

        Args:
            attributes: Raw attributes dictionary

        Returns:
            Parsed attributes dictionary sorted by key
        """
        if not attributes:
            return {}

        parsed = {}
        for attr_name in sorted(attributes.keys()):
            attr = attributes[attr_name]
            if isinstance(attr, dict):
                parsed_attr = {}

                if "description" in attr:
                    parsed_attr["description"] = attr["description"]
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
        """
        Parse metrics with deterministic ordering.

        Args:
            metrics: Raw metrics dictionary

        Returns:
            Parsed metrics dictionary sorted by key
        """
        if not metrics:
            return {}

        parsed = {}
        for metric_name in sorted(metrics.keys()):
            metric = metrics[metric_name]
            if isinstance(metric, dict):
                parsed_metric = {}

                if "description" in metric:
                    parsed_metric["description"] = metric["description"]
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
