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

BACKFILLABLE_FIELDS = ["display_name", "description", "library_link"]


def backfill_metadata(
    versions: list[Version],
    load_inventory_fn: Callable[[Version], dict[str, Any]],
    item_key: str = "libraries",
) -> dict[Version, dict[str, Any]]:
    """Backfill metadata across versions.

    Ensures metadata fields are consistently available across all versions.
    If versions 1.1-1.3 lack a display_name but 1.4 has it, backfill 1.4's
    value to 1.1-1.3. If 1.5 updates it, use the new value for 1.5+.

    The backfilling happens in three phases:
    1. Collect Timeline: Load all versions and track first appearance of each field
    2. Apply Backfill: Process versions chronologically, backfill missing fields
    3. Return: Provide backfilled inventories ready for processing

    Args:
        versions: List of versions sorted oldest to newest
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

    inventories = {}
    metadata_timeline = _build_metadata_timeline(versions, load_inventory_fn, item_key, inventories)

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
                        logger.debug(
                            f"Backfilled {field} for {item_name} in {version} with value: {backfilled_value[:50]}..."
                            if len(backfilled_value) > 50
                            else f"with value: {backfilled_value}"
                        )

            backfilled_items.append(backfilled_item)

        backfilled_inventory = inventory.copy()
        backfilled_inventory[item_key] = backfilled_items
        backfilled_inventories[version] = backfilled_inventory

    logger.info("Metadata backfill completed")
    return backfilled_inventories


def _build_metadata_timeline(
    versions: list[Version],
    load_inventory_fn: Callable[[Version], dict[str, Any]],
    item_key: str,
    inventories: dict[Version, dict[str, Any]],
) -> dict[str, dict[str, dict[Version, str]]]:
    """Build timeline of metadata changes for all items.

    Args:
        versions: List of versions sorted oldest to newest
        load_inventory_fn: Function that loads inventory for a version
        item_key: Key for items list in inventory
        inventories: Dict to populate with loaded inventories

    Returns:
        Nested dict: {item_name: {field_name: {version: value}}}
    """
    metadata_timeline = defaultdict(lambda: defaultdict(dict))

    for version in versions:
        inventory = load_inventory_fn(version)
        inventories[version] = inventory

        items = inventory.get(item_key, [])
        for item in items:
            item_name = item.get("name")
            if not item_name:
                continue

            for field in BACKFILLABLE_FIELDS:
                if field in item and item[field]:
                    metadata_timeline[item_name][field][version] = item[field]

    return metadata_timeline


def _needs_backfill(item: dict[str, Any], field: str) -> bool:
    """Check if a field needs backfilling.

    A field needs backfilling if it's missing or empty string.

    Args:
        item: The item to check
        field: The field name

    Returns:
        True if the field needs backfilling, False otherwise
    """
    return field not in item or not item[field]


def _find_backfill_value(item_name: str, field: str, current_version: Version, metadata_timeline: dict) -> str | None:
    """Find the appropriate backfill value for a field.

    Searches forward in time to find the next available value for the field.

    Args:
        item_name: Name of the item
        field: Field name to backfill
        current_version: Version being processed
        metadata_timeline: Timeline of metadata changes

    Returns:
        The backfill value, or None if no value found
    """
    if item_name not in metadata_timeline:
        return None

    if field not in metadata_timeline[item_name]:
        return None

    field_timeline = metadata_timeline[item_name][field]
    if not field_timeline:
        return None

    # Find the first value at or after the current version
    sorted_versions = sorted(field_timeline.keys())

    for version in sorted_versions:
        if version >= current_version:
            return field_timeline[version]

    return None
