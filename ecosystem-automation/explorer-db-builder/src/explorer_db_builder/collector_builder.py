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
"""Orchestrates the collector database build pipeline."""

import logging
from typing import Optional

from collector_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from explorer_db_builder.collector_transformer import transform_collector_components

logger = logging.getLogger(__name__)

DISTRIBUTIONS = ["core", "contrib"]

# Only build the database for versions >= this. Keeps the output bounded and
# avoids including very old registry data that pre-dates reliable metadata.
MINIMUM_VERSION = Version("0.150.0")


def _get_merged_release_versions(inventory_manager: InventoryManager) -> list[Version]:
    """Collect the union of release versions from all distributions, sorted latest-first.

    Only versions >= MINIMUM_VERSION are included.

    Args:
        inventory_manager: Collector inventory manager.

    Returns:
        Deduplicated, sorted (newest-first) list of release versions >= MINIMUM_VERSION.

    Raises:
        ValueError: If no qualifying release versions exist across any distribution.
    """
    version_set: set[Version] = set()
    for distribution in DISTRIBUTIONS:
        versions = inventory_manager.list_release_versions(distribution)
        version_set.update(v for v in versions if v >= MINIMUM_VERSION)

    if not version_set:
        raise ValueError(f"No release versions >= {MINIMUM_VERSION} found in collector inventory")

    return sorted(version_set, reverse=True)


def _process_version(
    version: Version,
    inventory_manager: InventoryManager,
    db_writer: CollectorDatabaseWriter,
) -> tuple[dict[str, str], list[dict]]:
    """Load, transform, and write all components for a single version.

    Loads data from every distribution and merges into one flat component list.

    Args:
        version: The version to process.
        inventory_manager: Source of raw registry data.
        db_writer: Destination writer.

    Returns:
        Tuple of (component_map, components) where component_map is
        {component_id: hash} and components is the flat list of canonical dicts.
        Both are empty if no components were found.
    """
    logger.info("Processing collector version: %s", version)
    all_components = []

    for distribution in DISTRIBUTIONS:
        inventory = inventory_manager.load_versioned_inventory(distribution, version)
        components = transform_collector_components(inventory, distribution)
        logger.info("  %s: %d components", distribution, len(components))
        all_components.extend(components)

    logger.info("  Total: %d components", len(all_components))

    if not all_components:
        logger.warning("No components found for version %s, skipping", version)
        return {}, []

    component_map = db_writer.write_components(all_components)
    db_writer.write_version_index(version, component_map)
    return component_map, all_components


def run_collector_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[CollectorDatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the collector database builder pipeline.

    Args:
        inventory_manager: Optional override for testing.
        db_writer: Optional override for testing.
        clean: If True, wipe the output directory before building.

    Returns:
        Exit code: 0 for success, 1 for failure.
    """
    try:
        inventory_manager = inventory_manager or InventoryManager()
        db_writer = db_writer or CollectorDatabaseWriter()

        if clean:
            db_writer.clean()

        versions = _get_merged_release_versions(inventory_manager)
        logger.info("Processing %d collector release version(s)", len(versions))

        processed_versions: list[Version] = []
        latest_components: list[dict] = []

        for version in versions:
            component_map, components = _process_version(version, inventory_manager, db_writer)
            if not component_map:
                continue

            processed_versions.append(version)
            if not latest_components:
                latest_components = components

        if not processed_versions:
            raise ValueError("No collector versions were successfully processed")

        db_writer.write_version_list(processed_versions)
        db_writer.write_index(latest_components)

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)

        logger.info("")
        logger.info("Collector Database Statistics:")
        logger.info("  Files written: %d", stats["files_written"])
        logger.info("  Total size: %d bytes (%.2f MB)", stats["total_bytes"], total_mb)
        logger.info("")
        logger.info("✓ Collector database build completed successfully")
        return 0

    except ValueError as e:
        logger.error("❌ Validation error: %s", e)
        return 1
    except KeyError as e:
        logger.error("❌ Data structure error: %s", e)
        return 1
    except OSError as e:
        logger.error("❌ File system error: %s", e)
        return 1
    except Exception as e:
        logger.error("❌ Unexpected error: %s", e, exc_info=True)
        return 1
