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
"""Aggregate per-instrumentation configurations into a single global list.

Produces the data for global-configurations.json during the javaagent build. Pure (no I/O);
DatabaseWriter writes the file.
"""

from typing import Any

# Scalar fields filled from older versions when missing on the newest (seed) entry. "example" is
# singular on purpose: the data uses "examples" (plural), so this fill is a no-op and "examples" is
# reconciled across versions upstream by metadata_backfiller.
_MERGE_FIELDS = ("declarative_name", "description", "default", "type", "example")


def _collect_items(inventory: dict[str, Any]) -> list[dict[str, Any]]:
    """Return all instrumentation items from both the libraries and custom lists."""
    items: list[dict[str, Any]] = []
    for key in ("libraries", "custom"):
        value = inventory.get(key)
        if isinstance(value, list):
            items.extend(value)
    return items


def build_global_configurations(inventories_newest_first: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge configurations across all versions into a sorted global list.

    Inventories must be newest-version first: the first occurrence of a config name seeds the entry
    (newest wins) and older occurrences only fill empty fields. Entries are shallow copies of the
    source configs, so the input inventories are never mutated. Returns configs sorted by name, each
    with a sorted "instrumentations" list.
    """
    merged: dict[str, dict[str, Any]] = {}
    instrumentation_sets: dict[str, set[str]] = {}

    for inventory in inventories_newest_first:
        for item in _collect_items(inventory):
            instrumentation_name = item.get("name")
            configurations = item.get("configurations")
            if not instrumentation_name or not isinstance(configurations, list):
                continue

            for config in configurations:
                config_name = config.get("name")
                if not config_name:
                    continue

                if config_name not in merged:
                    merged[config_name] = dict(config)
                    instrumentation_sets[config_name] = set()
                else:
                    existing = merged[config_name]
                    for field in _MERGE_FIELDS:
                        if not existing.get(field) and config.get(field):
                            existing[field] = config[field]

                instrumentation_sets[config_name].add(instrumentation_name)

    result: list[dict[str, Any]] = []
    for config_name in sorted(merged):
        entry = merged[config_name]
        entry["instrumentations"] = sorted(instrumentation_sets[config_name])
        result.append(entry)
    return result
