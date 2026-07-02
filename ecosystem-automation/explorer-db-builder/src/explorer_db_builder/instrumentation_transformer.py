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
"""Transforms instrumentation data from different file format versions to a common schema."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def transform_instrumentation_format(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform instrumentation inventory data to the latest format.

    Handles transformation from different file_format versions to the current schema.

    Args:
        inventory_data: Raw inventory data from registry

    Returns:
        Transformed inventory data with libraries in the latest format

    Raises:
        ValueError: If file_format is missing or unsupported
        KeyError: If required fields are missing in the inventory data
    """
    if "file_format" not in inventory_data:
        raise ValueError("Inventory data missing 'file_format' field")

    file_format = inventory_data["file_format"]

    if file_format == 0.5:
        logger.debug("File format 0.5 detected, no transformation needed")
        return inventory_data
    if file_format == 0.3:
        logger.debug("File format 0.3 detected, transforming to 0.5")
        return _transform_0_3_to_0_5(inventory_data)
    if file_format == 0.2:
        logger.debug("File format 0.2 detected, transforming to 0.3")
        return _transform_0_3_to_0_5(_transform_0_2_to_0_3(inventory_data))
    elif file_format == 0.1:
        logger.debug("File format 0.1 detected, transforming to 0.2")
        bump_to_0_2 = _transform_0_1_to_0_2(inventory_data)
        logger.debug("Now transforming from 0.2 to 0.3")
        bump_to_0_3 = _transform_0_2_to_0_3(bump_to_0_2)
        logger.debug("Now transforming from 0.3 to 0.5")
        return _transform_0_3_to_0_5(bump_to_0_3)
    else:
        raise ValueError(f"Unsupported file format: {file_format}")


def _transform_library_list_0_1_to_0_2(library_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    transformed_libraries = []
    for library in library_list:
        transformed_lib = library.copy()
        if "target_versions" in transformed_lib:
            target_versions = transformed_lib["target_versions"]
            if "javaagent" in target_versions:
                transformed_lib["javaagent_target_versions"] = target_versions["javaagent"]
            if "library" in target_versions and target_versions["library"]:
                transformed_lib["has_standalone_library"] = True
            else:
                transformed_lib["has_standalone_library"] = False
            del transformed_lib["target_versions"]
        transformed_libraries.append(transformed_lib)
    return transformed_libraries


def _transform_0_1_to_0_2(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform file_format 0.1 to 0.2.

    Changes:
    - target_versions.javaagent -> javaagent_target_versions
    - target_versions.library presence -> has_standalone_library boolean
    - Removes target_versions field entirely

    Args:
        inventory_data: Inventory data in format 0.1

    Returns:
        Transformed inventory data in format 0.2
    """
    if "libraries" not in inventory_data or inventory_data["libraries"] is None:
        raise KeyError("Inventory data missing 'libraries' key")

    transformed_data = inventory_data.copy()
    if inventory_data.get("libraries") is not None:
        transformed_data["libraries"] = _transform_library_list_0_1_to_0_2(inventory_data["libraries"])

    if inventory_data.get("custom") is not None:
        transformed_data["custom"] = _transform_library_list_0_1_to_0_2(inventory_data["custom"])

    transformed_data["file_format"] = 0.2

    logger.info("Transformed inventory from format 0.1 to 0.2")

    return transformed_data


def _transform_library_list_0_2_to_0_3(library_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    transformed_libraries = []
    for library in library_list:
        transformed_lib = library.copy()
        if "telemetry" in transformed_lib:
            transformed_telemetry = []
            for telemetry_entry in transformed_lib["telemetry"]:
                transformed_entry = telemetry_entry.copy()
                if "metrics" in transformed_entry:
                    transformed_metrics = []
                    for metric in transformed_entry["metrics"]:
                        transformed_metric = metric.copy()
                        if "type" in transformed_metric:
                            transformed_metric["data_type"] = transformed_metric["type"]
                            del transformed_metric["type"]
                        transformed_metrics.append(transformed_metric)
                    transformed_entry["metrics"] = transformed_metrics
                transformed_telemetry.append(transformed_entry)
            transformed_lib["telemetry"] = transformed_telemetry
        transformed_libraries.append(transformed_lib)
    return transformed_libraries


def _transform_0_2_to_0_3(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform file_format 0.2 to 0.3.

    Changes from 0.2:
        - 'type' field renamed to 'data_type' in telemetry metrics

    Args:
        inventory_data: Inventory data in format 0.2

    Returns:
        Transformed inventory data in format 0.3
    """

    transformed_data = inventory_data.copy()

    if inventory_data.get("libraries") is not None:
        transformed_data["libraries"] = _transform_library_list_0_2_to_0_3(inventory_data["libraries"])

    if inventory_data.get("custom") is not None:
        transformed_data["custom"] = _transform_library_list_0_2_to_0_3(inventory_data["custom"])

    transformed_data["file_format"] = 0.3
    logger.info("Transformed inventory from format 0.2 to 0.3")

    return transformed_data


def _transform_0_3_to_0_5(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform file_format 0.3 to 0.5.

    0.5 introduces new optional fields:
    - ``has_javaagent`` at the library level
    - ``declarative_name`` and ``examples`` in each configuration entry

    No structural changes are needed; missing values are populated later by the
    metadata backfiller using data from versions that do have the new fields.

    Args:
        inventory_data: Inventory data in format 0.3

    Returns:
        Inventory data tagged as format 0.5
    """
    transformed_data = inventory_data.copy()
    transformed_data["file_format"] = 0.5
    logger.info("Transformed inventory from format 0.3 to 0.5")
    return transformed_data


def _strip_version_range(coordinate: str) -> str:
    """Drop the version range from a Maven coordinate (``group:artifact:[6.0.0,)``
    -> ``group:artifact``); non-coordinate strings (e.g. ``Java 8+``) pass through."""
    parts = coordinate.split(":")
    return ":".join(parts[:2]) if len(parts) >= 3 else coordinate


def _collect_search_terms(instrumentation: dict[str, Any]) -> list[str]:
    """Distinctive, searchable identifiers for the index.json ``search_terms`` field.

    Limited to high-signal terms (scope name, semantic conventions, features, Maven
    coordinate, config name/declarative_name/description, metric name/description);
    noisy fields and the seeded name/display_name/description are excluded. Returns
    ``sorted(set(...))`` for a stable content hash.
    """
    terms: set[str] = set()

    def add(value: Any) -> None:
        if value is None or isinstance(value, (dict, list)):
            return
        text = str(value).strip()
        if text:
            terms.add(text)

    scope = instrumentation.get("scope") or {}
    add(scope.get("name"))

    for value in instrumentation.get("semantic_conventions") or []:
        add(value)
    for value in instrumentation.get("features") or []:
        add(value)
    for value in instrumentation.get("javaagent_target_versions") or []:
        add(_strip_version_range(value) if isinstance(value, str) else value)

    for configuration in instrumentation.get("configurations") or []:
        add(configuration.get("name"))
        add(configuration.get("declarative_name"))
        add(configuration.get("description"))

    for telemetry in instrumentation.get("telemetry") or []:
        for metric in telemetry.get("metrics") or []:
            add(metric.get("name"))
            add(metric.get("description"))

    return sorted(terms)


def make_index_instrumentation(instrumentation: dict[str, Any]) -> dict[str, Any]:
    """Extract lightweight metadata for the javaagent index.json.

    The index powers initial page load, browsing, and client-side filtering
    without fetching every full instrumentation file. Full detail stays in the
    content-addressed component files and is loaded on demand.

    Args:
        instrumentation: Full canonical instrumentation dict (must have "name").

    Returns:
        Minimal dict suitable for the index components list.
    """
    telemetry = instrumentation.get("telemetry")
    return {
        "name": instrumentation["name"],
        "display_name": instrumentation.get("display_name"),
        "description": instrumentation.get("description"),
        # Booleans the browse/search UI filters on without loading full detail.
        "has_telemetry": bool(telemetry),
        "has_standalone_library": bool(instrumentation.get("has_standalone_library")),
        # Precomputed global-search terms (sorted, deduped) so the frontend search
        # source reads the slim index instead of fanning out to full detail.
        "search_terms": _collect_search_terms(instrumentation),
    }


def make_list_instrumentation(instrumentation: dict[str, Any], *, is_custom: bool) -> dict[str, Any]:
    """Project a full instrumentation down to the slim shape the list/catalog page reads.

    The list page consumes every instrumentation for a version at once. Rather
    than fan out one fetch per instrumentation (or ship the full detail), it
    loads a single consolidated bundle of these slim entries. The page reads
    ``telemetry`` only to decide whether to show spans/metrics badges and to
    drive the spans/metrics filter, never the span/metric detail — so we
    precompute ``has_spans``/``has_metrics`` and drop the heavy ``telemetry``
    array entirely. Full detail stays in the content-addressed component files,
    loaded on demand by detail pages.

    ``configurations`` and ``disabled_by_default`` are carried through because
    the same bundle feeds the Configuration Builder (via ``loadAllInstrumentations``):
    it renders per-module options from ``configurations`` and derives each
    module's default enabled/disabled state (and the initial customization
    toggle) from ``disabled_by_default``.

    ``scope`` is carried through because the frontend ``InstrumentationData``
    contract requires it; it is small. ``_is_custom`` is injected here (the one
    place) so list rows match what the singular detail loader produces.

    Args:
        instrumentation: Full canonical instrumentation dict (must have "name").
        is_custom: Whether this is a custom (non-upstream) instrumentation.

    Returns:
        Slim instrumentation dict for the per-version list bundle.
    """
    telemetry = instrumentation.get("telemetry") or []
    entry: dict[str, Any] = {
        "name": instrumentation["name"],
        "scope": instrumentation.get("scope"),
        "display_name": instrumentation.get("display_name"),
        "description": instrumentation.get("description"),
        "has_javaagent": instrumentation.get("has_javaagent"),
        "has_standalone_library": instrumentation.get("has_standalone_library"),
        "semantic_conventions": instrumentation.get("semantic_conventions"),
        "features": instrumentation.get("features"),
        "configurations": instrumentation.get("configurations"),
        "disabled_by_default": instrumentation.get("disabled_by_default"),
        "has_spans": any((t.get("spans") or []) for t in telemetry),
        "has_metrics": any((t.get("metrics") or []) for t in telemetry),
        "_is_custom": is_custom,
    }
    # Drop keys that are absent in the source so the bundle stays compact and the
    # content hash is stable regardless of which optional fields a version omits.
    return {k: v for k, v in entry.items() if v is not None}
