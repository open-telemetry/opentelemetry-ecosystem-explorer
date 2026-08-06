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
(the current schema shape).

Two kinds of change touch this file, and they are handled differently:
- An upstream schema version change (the shape of metadata.yaml itself
  changes) gets a new parser class registered in MetadataParserFactory,
  leaving existing parser classes untouched so historical registry versions
  stay reproducible from the parser that originally produced them.
- A parser bug fix or read-completeness fix (this parser mis-reading or
  mis-normalizing the *current* schema, as opposed to the schema itself
  changing) instead modifies the existing parser class directly.

Either kind of change that alters output requires re-extracting all
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

    Gives dedicated normalization (sanitized descriptions, deterministic key/
    list ordering) to: description, status, attributes, metrics,
    resource_attributes, telemetry.metrics, events. Every other field present
    in the source file — `type`, `display_name`, `sem_conv_version`, `config`,
    `entities`, `feature_gates`, or anything the upstream mdatagen schema adds
    later — is passed through verbatim rather than dropped (see
    `_merge_known_fields`), so new fields do not require a code change here.
    The same pass-through-unless-normalized rule applies one level down
    inside `status`, each `attributes`/`resource_attributes` entry, each
    `metrics`/`events` entry, and `telemetry`: only the specific sub-fields
    that need sanitization or stable ordering are enumerated, and anything
    else on those objects is preserved as-is. Output is key-sorted at every
    depth (`_sorted_deep`) without ever reordering sequences, so the same
    input always serializes identically regardless of upstream field order.

    `EXCLUDED_FIELDS` names fields dropped entirely instead of passed
    through, as dotted paths relative to the parsed output root (e.g.
    `"status.disable_codecov_badge"` drops that one field from the nested
    `status` object while leaving `status.warnings`/`status.deprecation`
    alone; a bare name like `"tests"` drops a top-level field).

    This is a parser bug/read-completeness fix, not an upstream schema
    version change, so it modifies this class directly rather than adding a
    MetadataParserV2 (see the module and MetadataParserFactory docstrings);
    it requires a backfill to apply to already-extracted registry versions.
    """

    #: Fields dropped from parsed output entirely, rather than passed through
    #: generically. Entries are dotted paths relative to the parsed output
    #: root: a bare name (`"tests"`) excludes a top-level field, while
    #: `"status.disable_codecov_badge"` excludes only that field from within
    #: the nested `status` object. `tests` is fixture/test-only config, and
    #: `status.disable_codecov_badge` is a repo-housekeeping flag on the
    #: upstream file's status block — neither has value to the registry.
    #: Extend this set to exclude additional fields in the future.
    EXCLUDED_FIELDS: frozenset[str] = frozenset({"tests", "status.disable_codecov_badge"})

    def get_schema_version(self) -> str:
        return "v1"

    def parse(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        if not raw:
            return None

        normalized: dict[str, Any] = {}

        if "description" in raw:
            normalized["description"] = self._sanitize_description(raw["description"])

        if "status" in raw:
            normalized["status"] = self._parse_status(raw["status"])

        if "attributes" in raw:
            normalized["attributes"] = self._parse_attributes(raw["attributes"])

        if "metrics" in raw:
            normalized["metrics"] = self._parse_metrics(raw["metrics"])

        if "resource_attributes" in raw:
            normalized["resource_attributes"] = self._parse_attributes(raw["resource_attributes"])

        if isinstance(raw.get("telemetry"), dict):
            telemetry = raw["telemetry"]
            telemetry_normalized: dict[str, Any] = {}
            if "metrics" in telemetry:
                telemetry_normalized["metrics"] = self._parse_metrics(telemetry["metrics"])
            normalized["telemetry"] = self._merge_known_fields(telemetry, telemetry_normalized)

        if "events" in raw:
            # `events` entries have the same shape as `metrics` entries
            # (enabled/description/extended_documentation/warnings/attributes),
            # so they get the same normalization.
            normalized["events"] = self._parse_metrics(raw["events"])

        parsed = self._merge_known_fields(raw, normalized, exclude=self.EXCLUDED_FIELDS)
        return parsed or None

    @staticmethod
    def _sanitize_description(description: str) -> str:
        """Normalise multi-line YAML descriptions to a single clean string."""
        if not description:
            return description
        cleaned = description.strip().replace("\n", " ")
        return re.sub(r"\s+", " ", cleaned)

    @staticmethod
    def _merge_known_fields(
        source: dict[str, Any],
        normalized: dict[str, Any],
        exclude: frozenset[str] = frozenset(),
        path_prefix: str = "",
    ) -> dict[str, Any]:
        """Layer normalized values over a verbatim copy of `source`, deep-sorted.

        Fields present in `normalized` (dedicated sanitization/ordering) win;
        every other field from `source` is copied through unchanged so
        unrecognized or future schema fields are never silently dropped.

        `exclude` names dotted paths, relative to the parsed output root, to
        drop entirely rather than pass through (e.g.
        `"status.disable_codecov_badge"`). `path_prefix` is this call's own
        location in that dotted-path space — `""` at the top level, `"status"`
        when merging the nested status object — so a single exclusion set
        can reach into nested objects without each nested caller needing its
        own exclusion logic.

        The result is key-sorted at every depth via `_sorted_deep` (without
        reordering any sequences), so the same input always produces the same
        output regardless of the source YAML's field order, keeping the
        content-addressed registry output deterministic.
        """
        merged = {**source, **normalized}
        for key in list(merged):
            path = f"{path_prefix}.{key}" if path_prefix else key
            if path in exclude:
                del merged[key]
        return MetadataParserV1._sorted_deep(merged)

    @staticmethod
    def _sorted_deep(value: Any) -> Any:
        """Recursively key-sort mappings at any depth.

        Sequence *order* is never changed — some upstream lists are
        order-significant (e.g. `histogram.bucket_boundaries`); only the keys
        of mappings inside them are sorted.
        """
        if isinstance(value, dict):
            return {k: MetadataParserV1._sorted_deep(v) for k, v in sorted(value.items())}
        if isinstance(value, list):
            return [MetadataParserV1._sorted_deep(v) for v in value]
        return value

    def _parse_status(self, status: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}

        if "stability" in status:
            stability: dict[str, Any] = {}
            for level in sorted(status["stability"].keys()):
                signals = status["stability"][level]
                stability[level] = sorted(signals) if isinstance(signals, list) else signals
            normalized["stability"] = stability

        if "distributions" in status:
            dists = status["distributions"]
            normalized["distributions"] = sorted(dists) if isinstance(dists, list) else dists

        if "unsupported_platforms" in status:
            platforms = status["unsupported_platforms"]
            normalized["unsupported_platforms"] = sorted(platforms) if isinstance(platforms, list) else platforms

        return self._merge_known_fields(status, normalized, exclude=self.EXCLUDED_FIELDS, path_prefix="status")

    def _parse_attributes(self, attributes: dict[str, Any]) -> dict[str, Any]:
        if not attributes:
            return {}

        parsed: dict[str, Any] = {}
        for attr_name in sorted(attributes.keys()):
            attr = attributes[attr_name]
            if isinstance(attr, dict):
                normalized: dict[str, Any] = {}
                if "description" in attr:
                    normalized["description"] = self._sanitize_description(attr["description"])
                if "enum" in attr:
                    normalized["enum"] = sorted(attr["enum"]) if isinstance(attr["enum"], list) else attr["enum"]
                parsed[attr_name] = self._merge_known_fields(attr, normalized)
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
                normalized: dict[str, Any] = {}
                if "description" in metric:
                    normalized["description"] = self._sanitize_description(metric["description"])
                if "attributes" in metric:
                    attrs = metric["attributes"]
                    normalized["attributes"] = sorted(attrs) if isinstance(attrs, list) else attrs
                parsed[metric_name] = self._merge_known_fields(metric, normalized)
            else:
                parsed[metric_name] = metric

        return parsed


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


class MetadataParserFactory:
    """Routes metadata.yaml content to the correct version-specific parser.

    To add support for a new upstream schema version (the shape of
    metadata.yaml itself changes):
    1. Create MetadataParserV2(BaseMetadataParser) with the new extraction logic.
    2. Register it: _parsers["v2"] = MetadataParserV2
    3. Leave MetadataParserV1 untouched, so historical registry versions stay
       reproducible from the parser that originally produced them.

    A parser bug fix or read-completeness fix for the *current* schema (as
    opposed to the schema itself changing) instead modifies the existing
    parser class directly and requires a backfill; it does not need a new
    parser class.
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
