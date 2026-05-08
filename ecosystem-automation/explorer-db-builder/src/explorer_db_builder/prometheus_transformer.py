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
"""Transforms raw Prometheus registry data into the canonical output component shape."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

COMPONENT_TYPES = ["exporter", "sdk"]


def _make_component_id(distribution: str, component_type: str, name: str) -> str:
    return f"prometheus-{distribution}-{component_type}-{name}"


def transform_prometheus_components(
    inventory: dict[str, Any],
    distribution: str,
) -> list[dict[str, Any]]:
    """Transform a loaded inventory dict into a flat list of canonical component dicts.

    Args:
        inventory: Result of InventoryManager.load_versioned_inventory(distribution, version).
        distribution: Distribution name ("official" or "community").

    Returns:
        List of canonical component dicts.
    """
    components_by_type: dict[str, list[dict[str, Any]]] = inventory.get("components", {})
    results: list[dict[str, Any]] = []

    for component_type in COMPONENT_TYPES:
        raw_components = components_by_type.get(component_type, [])
        for raw in raw_components:
            if not isinstance(raw, dict):
                continue

            name = raw.get("name")
            if not name:
                continue

            metadata: dict[str, Any] = raw.get("metadata") or {}

            component: dict[str, Any] = {
                "id": _make_component_id(distribution, component_type, name),
                "ecosystem": "prometheus",
                "distribution": distribution,
                "type": component_type,
                "name": name,
                "display_name": metadata.get("display_name"),
                "description": metadata.get("description"),
                "repository": metadata.get("repository"),
                "website": metadata.get("website"),
            }

            # Add SDK specific fields
            if component_type == "sdk":
                component["language"] = metadata.get("language")

            # Add Exporter specific fields
            if component_type == "exporter":
                component["category"] = metadata.get("type")

            results.append(component)

    return results


def make_index_component(component: dict[str, Any]) -> dict[str, Any]:
    """Extract lightweight metadata for use in the ecosystem index.json.

    Args:
        component: Full canonical component dict.

    Returns:
        Minimal dict suitable for the index components list.
    """
    return {
        "id": component["id"],
        "name": component["name"],
        "distribution": component["distribution"],
        "type": component["type"],
        "display_name": component.get("display_name"),
        "description": component.get("description"),
    }
