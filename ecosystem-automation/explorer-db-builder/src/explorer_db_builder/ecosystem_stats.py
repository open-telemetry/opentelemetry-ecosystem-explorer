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
"""Aggregate cross-version counts for the About page's ecosystem-stats.json.

Produces the counts written to ecosystem-stats.json during the javaagent and collector
builds. Pure (no I/O); the respective DatabaseWriter writes the file. index.json only
reflects the latest version, so these unions must run over every loaded version instead.
"""

from typing import Any


def count_unique_java_library_names(inventories: list[dict[str, Any]]) -> int:
    """Count unique instrumentation names across all versions.

    Libraries and custom instrumentations are counted together, matching how every other
    javaagent artifact (index.json, version bundles) already treats the two lists as one
    combined instrumentation set.

    Args:
        inventories: Per-version inventories, each with "libraries" and/or "custom" lists.

    Returns:
        The number of distinct instrumentation names across all inventories.
    """
    names: set[str] = set()
    for inventory in inventories:
        for key in ("libraries", "custom"):
            for item in inventory.get(key) or []:
                name = item.get("name")
                if name:
                    names.add(name)
    return len(names)


def count_unique_collector_component_ids(components_by_version: list[list[dict[str, Any]]]) -> int:
    """Count unique collector component ids across all versions.

    Args:
        components_by_version: One list of canonical component dicts (each with an "id"
            field) per processed version.

    Returns:
        The number of distinct component ids across all versions.
    """
    ids: set[str] = set()
    for components in components_by_version:
        for component in components:
            component_id = component.get("id")
            if component_id:
                ids.add(component_id)
    return len(ids)
