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
"""Backfills missing metadata fields across versions."""

import logging
from collections import defaultdict
from typing import Any, Callable

from semantic_version import Version

logger = logging.getLogger(__name__)

BACKFILLABLE_FIELDS = ["display_name", "description", "library_link", "has_javaagent"]
NESTED_BACKFILLABLE_FIELDS: dict[str, list[str]] = {
    "configurations": ["declarative_name", "examples"],
}


def backfill_metadata(
    versions: list[Version],
    load_inventory_fn: Callable[[Version], dict[str, Any]],
    item_key: str = "libraries",
) -> dict[Version, dict[str, Any]]:
    """Backfill metadata across versions.

    Ensures metadata fields are consistently available across all versions.
    If versions 1.1-1.3 lack a display_name but 1.4 has it, backfill 1.4's
    value to 1.1-1.3. If 1.5 updates it, use the new value for 1.5+.

    Also backfills nested fields declared in ``NESTED_BACKFILLABLE_FIELDS``
    (e.g. per-configuration ``declarative_name`` and ``examples``) across
    versions, matching nested items by their ``name``.

    Args:
        versions: List of versions (unordered)
        load_inventory_fn: Function that loads inventory for a version
        item_key: Key for items list in inventory (e.g., "libraries", "components")

    Returns:
        Dict mapping version to backfilled inventory data

    Raises:
        KeyError: If inventory data is missing required keys
    """
    if not versions:
        return {}

    logger.info(f"Backfilling metadata across {len(versions)} versions")

    inventories: dict[Version, dict[str, Any]] = {}
    metadata_timeline, nested_timelines = _build_timelines(versions, load_inventory_fn, item_key, inventories)

    backfilled_inventories = {}
    for version in versions:
        inventory = inventories[version]
        items = inventory.get(item_key, [])

        backfilled_items = []
        for item in items:
            item_name = item.get("name")
            if not item_name:
                backfilled_items.append(item)
                continue

            backfilled_item = item.copy()

            for field in BACKFILLABLE_FIELDS:
                if _needs_backfill(item, field):
                    backfilled_value = _find_backfill_value(item_name, field, version, metadata_timeline)
                    if backfilled_value is not None:
                        backfilled_item[field] = backfilled_value
                        logger.debug(f"Backfilled {field} for {item_name} in {version}")

            for nested_key, nested_fields in NESTED_BACKFILLABLE_FIELDS.items():
                nested_items = backfilled_item.get(nested_key)
                if not nested_items:
                    continue
                per_item_timeline = nested_timelines[nested_key].get(item_name, {})
                backfilled_item[nested_key] = _backfill_nested_items(
                    nested_items, nested_fields, version, per_item_timeline, item_name, nested_key
                )

            backfilled_items.append(backfilled_item)

        backfilled_inventory = inventory.copy()
        backfilled_inventory[item_key] = backfilled_items
        backfilled_inventories[version] = backfilled_inventory

    logger.info("Metadata backfill completed")
    return backfilled_inventories


def _backfill_nested_items(
    nested_items: list[Any],
    nested_fields: list[str],
    version: Version,
    per_item_timeline: dict,
    parent_name: str,
    nested_key: str,
) -> list[Any]:
    """Backfill fields on a list of nested items (e.g. configurations).

    Args:
        nested_items: The nested items for the current version
        nested_fields: Field names to backfill
        version: Version being processed
        per_item_timeline: Timeline scoped to the parent item,
            shape {nested_name: {field: {version: value}}}
        parent_name: Name of the parent item (for logging)
        nested_key: Name of the nested collection (for logging)

    Returns:
        New list with backfilled nested items
    """
    result = []
    for nested_item in nested_items:
        if not isinstance(nested_item, dict):
            result.append(nested_item)
            continue

        nested_name = nested_item.get("name")
        if not nested_name:
            result.append(nested_item)
            continue

        backfilled = nested_item.copy()
        for field in nested_fields:
            if _needs_backfill(nested_item, field):
                backfilled_value = _find_backfill_value(nested_name, field, version, per_item_timeline)
                if backfilled_value is not None:
                    backfilled[field] = backfilled_value
                    logger.debug(f"Backfilled {nested_key}.{field} for {parent_name}/{nested_name} in {version}")
        result.append(backfilled)
    return result


def _build_timelines(
    versions: list[Version],
    load_inventory_fn: Callable[[Version], dict[str, Any]],
    item_key: str,
    inventories: dict[Version, dict[str, Any]],
) -> tuple[dict, dict]:
    """Build timelines of metadata changes.

    Args:
        versions: List of versions in any order
        load_inventory_fn: Function that loads inventory for a version
        item_key: Key for items list in inventory
        inventories: Dict to populate with loaded inventories

    Returns:
        Tuple of:
        - metadata_timeline: {item_name: {field: {version: value}}}
        - nested_timelines: {nested_key: {item_name: {nested_name: {field: {version: value}}}}}
    """
    metadata_timeline: dict = defaultdict(lambda: defaultdict(dict))
    nested_timelines: dict[str, dict] = {
        nested_key: defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
        for nested_key in NESTED_BACKFILLABLE_FIELDS
    }

    for version in versions:
        inventory = load_inventory_fn(version)
        inventories[version] = inventory

        items = inventory.get(item_key, [])
        for item in items:
            item_name = item.get("name")
            if not item_name:
                continue

            for field in BACKFILLABLE_FIELDS:
                if _has_value(item, field):
                    metadata_timeline[item_name][field][version] = item[field]

            for nested_key, fields in NESTED_BACKFILLABLE_FIELDS.items():
                nested_items = item.get(nested_key) or []
                for nested_item in nested_items:
                    if not isinstance(nested_item, dict):
                        continue
                    nested_name = nested_item.get("name")
                    if not nested_name:
                        continue
                    for field in fields:
                        if _has_value(nested_item, field):
                            nested_timelines[nested_key][item_name][nested_name][field][version] = nested_item[field]

    return metadata_timeline, nested_timelines


def _has_value(item: dict[str, Any], field: str) -> bool:
    """Check if an item has a meaningful (non-empty) value for a field.

    Treats missing keys, None, empty strings, and empty lists as absent.
    Boolean ``False`` is a meaningful value.
    """
    if field not in item:
        return False
    value = item[field]
    if value is None:
        return False
    if isinstance(value, str) and value == "":
        return False
    if isinstance(value, list) and not value:
        return False
    return True


def _needs_backfill(item: dict[str, Any], field: str) -> bool:
    """Check if a field needs backfilling."""
    return not _has_value(item, field)


def _find_backfill_value(item_name: str, field: str, current_version: Version, timeline: dict) -> Any | None:
    """Find the appropriate backfill value for a field.

    Searches forward in time to find the next available value for the field.

    Args:
        item_name: Name of the item
        field: Field name to backfill
        current_version: Version being processed
        timeline: Timeline shape {item_name: {field: {version: value}}}

    Returns:
        The backfill value, or None if no value found
    """
    if item_name not in timeline:
        return None

    if field not in timeline[item_name]:
        return None

    field_timeline = timeline[item_name][field]
    if not field_timeline:
        return None

    sorted_versions = sorted(field_timeline.keys())

    for version in sorted_versions:
        if version >= current_version:
            return field_timeline[version]

    return None
