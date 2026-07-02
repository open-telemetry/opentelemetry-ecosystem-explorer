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
from typing import Optional

from semantic_version import Version
from watcher_common.inventory_manager import JavaagentInventoryManager

from explorer_db_builder.collector_builder import run_collector_builder
from explorer_db_builder.configuration_aggregator import build_global_configurations
from explorer_db_builder.configuration_builder import run_configuration_builder
from explorer_db_builder.database_writer import DatabaseWriter
from explorer_db_builder.declarative_name_corrections import apply_declarative_name_corrections
from explorer_db_builder.ecosystem_stats import count_unique_java_library_names
from explorer_db_builder.instrumentation_transformer import (
    make_list_instrumentation,
    transform_instrumentation_format,
)
from explorer_db_builder.metadata_backfiller import backfill_metadata
from explorer_db_builder.telemetry_when_corrections import apply_telemetry_when_corrections

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


def get_release_versions(inventory_manager: JavaagentInventoryManager) -> list[Version]:
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
    inventory_manager: JavaagentInventoryManager,
    db_writer: DatabaseWriter,
    inventory: Optional[dict] = None,
) -> tuple[list[dict], str]:
    """Process a single version and write its data to the database.

    Handles both old (0.1) and new (0.2) file formats by transforming
    to the latest schema before writing.

    Args:
        version: The version to process
        inventory_manager: Manager for accessing inventory data
        db_writer: Writer for database operations
        inventory: Optional pre-loaded inventory (e.g., backfilled data)

    Returns:
        A tuple of (instrumentations, bundle_hash). The instrumentations are the
        full dicts written for this version (libraries followed by custom) so the
        caller can build the lightweight index; bundle_hash identifies the
        consolidated per-version bundle for versions-index.json.

    Raises:
        ValueError: If neither libraries nor custom instrumentations are found
            for the version, or if the inventory has an unsupported file format
        KeyError: If inventory data is malformed
    """
    logger.info(f"Processing Java Agent version: {version}")

    if inventory is None:
        inventory = inventory_manager.load_versioned_inventory(version)

    transformed_inventory = transform_instrumentation_format(inventory)

    if "libraries" not in transformed_inventory and "custom" not in transformed_inventory:
        raise KeyError(f"Inventory for version {version} missing 'libraries' and 'custom' keys")

    # `or []` (not a .get default) so an explicit "libraries": None in malformed or
    # partially-backfilled inventory normalizes to a list. Otherwise the
    # `[*libraries, *custom]` return below would raise TypeError unpacking None.
    libraries = transformed_inventory.get("libraries") or []
    custom = transformed_inventory.get("custom") or []

    if not libraries and not custom:
        raise ValueError(f"No instrumentations found in inventory for version {version}")

    logger.info(f"Found {len(libraries)} libraries and {len(custom)} custom instrumentations")

    library_map = db_writer.write_libraries(libraries) if libraries else {}
    custom_map = db_writer.write_libraries(custom) if custom else {}

    db_writer.write_version_index(version, library_map, custom_map)

    # Build the consolidated per-version bundle the frontend list view loads in a
    # single request. Entries are the slim shape the list page reads (telemetry
    # collapsed to has_spans/has_metrics flags); full detail stays in the
    # per-instrumentation files. _is_custom is injected here (the one place) so
    # list rows match what the singular detail loader produces.
    bundle_items = [make_list_instrumentation(lib, is_custom=False) for lib in libraries] + [
        make_list_instrumentation(c, is_custom=True) for c in custom
    ]
    bundle_hash = db_writer.write_version_bundle(version, bundle_items)

    return [*libraries, *custom], bundle_hash


def run_javaagent_builder(
    inventory_manager: Optional[JavaagentInventoryManager] = None,
    db_writer: Optional[DatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the javaagent database builder process.

    Args:
        inventory_manager: Optional inventory manager (for testing)
        db_writer: Optional database writer (for testing)
        clean: If True, clean the database directory before building

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        inventory_manager = inventory_manager or JavaagentInventoryManager()
        db_writer = db_writer or DatabaseWriter()

        if clean:
            db_writer.clean()

        versions = get_release_versions(inventory_manager)
        logger.info(f"Processing {len(versions)} release versions")

        # Pre-load README maps for all versions to enable augmentation and backfilling
        readme_maps = {v: inventory_manager.load_library_readme_map(v) for v in versions}

        # Publish all READMEs to the database
        for version, readme_map in readme_maps.items():
            for library_name, markdown_hash in readme_map.items():
                content = inventory_manager.load_library_readme_content(version, library_name, markdown_hash)
                if content is not None:
                    db_writer.write_markdown(library_name, markdown_hash, content)

        def load_and_augment_inventory(version: Version) -> dict:
            inventory = inventory_manager.load_versioned_inventory(version)
            readme_map = readme_maps.get(version, {})

            # Correct known-bad declarative_name values before backfill and aggregation so the
            # fix lands in both the per-version files and global-configurations.json.
            apply_declarative_name_corrections(inventory)
            # Correct known-bad telemetry when-conditions:
            # - fold known test-harness artifact when-conditions back into "default"
            # - move specific signals from "default" into their correct feature-gated when blocks
            apply_telemetry_when_corrections(inventory, version)

            # Normalize an explicit "libraries": None / "custom": None (malformed or
            # partial inventory, since YAML `libraries:` parses as None) to [] up front.
            # This both lets the augmentation loop below iterate safely and keeps the
            # downstream backfill/process_version steps from raising TypeError on None.
            for key in ["libraries", "custom"]:
                if inventory.get(key) is None and key in inventory:
                    inventory[key] = []

            # Augment libraries and custom instrumentations with markdown_hash.
            for key in ["libraries", "custom"]:
                for item in inventory.get(key, []):
                    name = item.get("name")
                    if name and name in readme_map:
                        item["markdown_hash"] = readme_map[name]

            return inventory

        backfilled_libraries = backfill_metadata(
            versions,
            load_and_augment_inventory,
            item_key="libraries",
        )
        backfilled_inventories = backfill_metadata(
            versions,
            lambda v: backfilled_libraries[v],
            item_key="custom",
        )

        # versions[0] is the latest release (the same version write_version_list
        # flags as is_latest), so the first processed version's instrumentations
        # feed the lightweight index.
        latest_instrumentations: list[dict] = []
        bundle_hashes: dict[Version, str] = {}
        for version in versions:
            inventory = backfilled_inventories.get(version)
            instrumentations, bundle_hash = process_version(version, inventory_manager, db_writer, inventory=inventory)
            bundle_hashes[version] = bundle_hash
            if not latest_instrumentations:
                latest_instrumentations = instrumentations

        db_writer.write_version_list(versions, bundle_hashes)
        db_writer.write_index(latest_instrumentations)

        global_configurations = build_global_configurations([backfilled_inventories[v] for v in versions])
        db_writer.write_global_configurations(global_configurations)

        db_writer.write_ecosystem_stats(
            {
                "version_count": len(versions),
                "library_count": count_unique_java_library_names([backfilled_inventories[v] for v in versions]),
            }
        )

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)

        logger.info("")
        logger.info("Database Statistics:")
        logger.info(f"  Files written: {stats['files_written']}")
        logger.info(f"  Total size: {stats['total_bytes']:,} bytes ({total_mb:.2f} MB)")
        logger.info("")
        logger.info("[*] Database build completed successfully")
        return 0

    except ValueError as e:
        logger.error(f"❌ Validation error: {e}")
        return 1
    except KeyError as e:
        logger.error(f"❌ Data structure error: {e}")
        return 1
    except OSError as e:
        logger.error(f"❌ File system error: {e}")
        return 1
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return 1


def run_builder(clean: bool = False, ecosystem: str = "all") -> int:
    """Run the selected database builder pipelines.

    Args:
        clean: If True, wipe the output directories before building.
        ecosystem: Which pipeline to run: "javaagent", "configuration", "collector", or "all".

    Returns:
        0 if all selected pipelines succeed, 1 if any fail.
    """
    results: list[int] = []

    if ecosystem in ("javaagent", "all"):
        logger.info("--- Java Agent ---")
        results.append(run_javaagent_builder(clean=clean))
        logger.info("")

    if ecosystem in ("configuration", "all"):
        logger.info("--- Configuration Schema ---")
        results.append(run_configuration_builder(clean=clean))
        logger.info("")

    if ecosystem in ("collector", "all"):
        logger.info("--- Collector ---")
        results.append(run_collector_builder(clean=clean))
        logger.info("")

    return 1 if any(r != 0 for r in results) else 0


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
    parser.add_argument(
        "--ecosystem",
        choices=["javaagent", "configuration", "collector", "all"],
        default="all",
        help="Which ecosystem pipeline to run (default: all)",
    )

    args = parser.parse_args()

    configure_logging()

    logger.info("=" * 60)
    logger.info("Explorer DB Builder")
    logger.info("=" * 60)
    logger.info("")

    exit_code = run_builder(clean=args.clean, ecosystem=args.ecosystem)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
