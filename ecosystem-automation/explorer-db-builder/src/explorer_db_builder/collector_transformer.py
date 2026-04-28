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
"""Transforms raw collector registry data into the canonical output component shape."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

COMPONENT_TYPES = ["connector", "exporter", "extension", "processor", "receiver"]

_STABILITY_RANK = {"stable": 3, "beta": 2, "alpha": 1, "development": 0}


def _derive_stability(stability: dict[str, list[str]] | None) -> str | None:
    """Return the highest-ranked stability level present across all signals.

    Args:
        stability: Dict mapping stability level to list of signals, e.g.
                   {"beta": ["metrics", "traces"], "alpha": ["profiles"]}

    Returns:
        Highest stability level string, or None if empty.
    """
    if not stability:
        return None
    best = max(stability.keys(), key=lambda lvl: _STABILITY_RANK.get(lvl, -1))
    return best


def _make_component_id(distribution: str, component_type: str, name: str) -> str:
    return f"{distribution}-{component_type}-{name}"


def transform_collector_components(
    inventory: dict[str, Any],
    distribution: str,
) -> list[dict[str, Any]]:
    """Transform a loaded inventory dict into a flat list of canonical component dicts.

    Args:
        inventory: Result of InventoryManager.load_versioned_inventory(distribution, version).
                   Shape: {distribution, version, repository, components: {type: [raw_component]}}
        distribution: Distribution name ("core" or "contrib").

    Returns:
        List of canonical component dicts, one per component across all types.
    """
    components_by_type: dict[str, list[dict[str, Any]]] = inventory.get("components", {})
    repository: str = inventory.get("repository", "")
    results: list[dict[str, Any]] = []

    for component_type in COMPONENT_TYPES:
        raw_components = components_by_type.get(component_type, [])
        for raw in raw_components:
            if not isinstance(raw, dict):
                logger.warning("Skipping non-dict component in %s/%s", distribution, component_type)
                continue

            name = raw.get("name")
            if not name:
                logger.warning("Skipping component without name in %s/%s", distribution, component_type)
                continue

            metadata: dict[str, Any] = raw.get("metadata") or {}
            status: dict[str, Any] = metadata.get("status") or {}

            component: dict[str, Any] = {
                "id": _make_component_id(distribution, component_type, name),
                "ecosystem": "collector",
                "distribution": distribution,
                "type": component_type,
                "name": name,
                "display_name": metadata.get("display_name"),
                "description": metadata.get("description"),
                "repository": repository,
                "status": status,
            }

            attributes = metadata.get("attributes")
            if attributes:
                component["attributes"] = attributes

            metrics = metadata.get("metrics")
            if metrics:
                component["metrics"] = metrics

            results.append(component)

    return results


def make_index_component(component: dict[str, Any]) -> dict[str, Any]:
    """Extract lightweight metadata for use in the ecosystem index.json.

    Args:
        component: Full canonical component dict.

    Returns:
        Minimal dict suitable for the index components list.
    """
    stability_raw = component.get("status", {}).get("stability")
    return {
        "id": component["id"],
        "name": component["name"],
        "distribution": component["distribution"],
        "type": component["type"],
        "display_name": component.get("display_name"),
        "description": component.get("description"),
        "stability": _derive_stability(stability_raw),
    }
