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
"""Main entry point for the Explorer Database Builder."""

import argparse
import logging
import sys
from typing import Any, Optional

from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.collector_transformer import transform_collector_data
from explorer_db_builder.configuration_builder import run_configuration_builder
from explorer_db_builder.database_writer import DatabaseWriter
from explorer_db_builder.instrumentation_transformer import transform_instrumentation_format
from explorer_db_builder.metadata_backfiller import backfill_metadata

logger = logging.getLogger(__name__)


def configure_logging(level: int = logging.INFO) -> None:
    """Configure logging for the application.

    Args:
        level: Logging level (default: INFO)
    """
    logging.basicConfig(
        level=level,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def get_release_versions(inventory_manager: InventoryManager) -> list[Version]:
    """Get list of release versions from the inventory.

    Filters out prerelease versions, returning only stable releases.

    Args:
        inventory_manager: Manager for accessing inventory data

    Returns:
        List of release versions (no prereleases)

    Raises:
        ValueError: If no versions or no release versions are found
    """
    versions = inventory_manager.list_versions()
    if not versions:
        raise ValueError("No versions found in inventory")

    release_versions = [v for v in versions if not v.prerelease]
    if not release_versions:
        raise ValueError("No release versions found in inventory (only prereleases)")

    return release_versions


def process_version(
    version: Version,
    inventory_manager: InventoryManager,
    db_writer: DatabaseWriter,
    inventory: Optional[dict] = None,
) -> None:
    """Process a single Java Agent version and write its data to the database."""
    logger.info(f"Processing Java Agent version: {version}")

    if inventory is None:
        inventory = inventory_manager.load_versioned_inventory(version)

    transformed_inventory = transform_instrumentation_format(inventory)

    if "libraries" not in transformed_inventory:
        raise KeyError(f"Inventory for version {version} missing 'libraries' key")

    libraries = transformed_inventory["libraries"]
    if not libraries:
        raise ValueError(f"No libraries found in inventory for version {version}")

    logger.info(f"Found {len(libraries)} libraries")

    library_map = db_writer.write_libraries(libraries)
    db_writer.write_version_index(version, library_map)


def process_collector_version(
    version: Version,
    distribution: str,
    inventory_manager: Any,
    db_writer: DatabaseWriter,
) -> dict[str, str]:
    """Process a single Collector version and write its data to the database."""
    logger.info(f"Processing Collector {distribution} version: {version}")

    inventory = inventory_manager.load_versioned_inventory(distribution, version)
    components = transform_collector_data(inventory)

    if not components:
        logger.warning(f"No components found for Collector {distribution} version {version}")
        return {}

    logger.info(f"Found {len(components)} components")
    return db_writer.write_components(components, sub_dir="components")


def run_javaagent_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[DatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the javaagent database builder process."""
    try:
        inventory_manager = inventory_manager or InventoryManager()
        db_writer = db_writer or DatabaseWriter("ecosystem-explorer/public/data/javaagent")

        if clean:
            db_writer.clean()

        versions = get_release_versions(inventory_manager)
        logger.info(f"Processing {len(versions)} release versions")

        backfilled_inventories = backfill_metadata(
            versions,
            inventory_manager.load_versioned_inventory,
            item_key="libraries",
        )

        for version in versions:
            inventory = backfilled_inventories.get(version)
            process_version(version, inventory_manager, db_writer, inventory=inventory)

        db_writer.write_version_list(versions)

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)

        logger.info("")
        logger.info("Database Statistics:")
        logger.info(f"  Files written: {stats['files_written']}")
        logger.info(f"  Total size: {stats['total_bytes']:,} bytes ({total_mb:.2f} MB)")
        logger.info("Database build completed successfully")
        return 0

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return 1
    except KeyError as e:
        logger.error(f"Data structure error: {e}")
        return 1
    except OSError as e:
        logger.error(f"File system error: {e}")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1


def run_collector_builder(clean: bool = False) -> int:
    """Run the collector database builder process."""
    try:
        from collector_watcher.inventory_manager import InventoryManager as CollectorInventoryManager

        inventory_manager = CollectorInventoryManager()
        db_writer = DatabaseWriter("ecosystem-explorer/public/data/collector")

        if clean:
            db_writer.clean()

        distributions = ["core", "contrib"]
        all_versions = set()
        for dist in distributions:
            all_versions.update(inventory_manager.list_release_versions(dist))

        sorted_versions = sorted(list(all_versions), reverse=True)
        logger.info(f"Processing {len(sorted_versions)} Collector release versions")

        for version in sorted_versions:
            version_component_map = {}
            for dist in distributions:
                if inventory_manager.version_exists(dist, version):
                    dist_map = process_collector_version(version, dist, inventory_manager, db_writer)
                    version_component_map.update(dist_map)

            if version_component_map:
                db_writer.write_version_index(version, version_component_map, index_key="components")

        db_writer.write_version_list(sorted_versions)

        stats = db_writer.get_stats()
        logger.info(f"Collector build completed: {stats['files_written']} files written")
        return 0

    except Exception as e:
        logger.error(f"Collector builder failed: {e}", exc_info=True)
        return 1


def run_builder(clean: bool = False) -> int:
    """Run all database builder pipelines. Returns 0 if both succeed, 1 if either fails."""
    logger.info("--- Java Agent ---")
    javaagent_result = run_javaagent_builder(clean=clean)

    logger.info("")
    logger.info("--- Collector ---")
    collector_result = run_collector_builder(clean=clean)

    logger.info("")
    logger.info("--- Configuration Schema ---")
    config_result = run_configuration_builder(clean=clean)

    if javaagent_result != 0 or collector_result != 0 or config_result != 0:
        return 1
    return 0


def main() -> None:
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Build content-addressed database from registry data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean the database directory before building",
    )

    args = parser.parse_args()

    configure_logging()

    logger.info("=" * 60)
    logger.info("Explorer DB Builder")
    logger.info("=" * 60)
    logger.info("")

    exit_code = run_builder(clean=args.clean)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
