"""Main entry point for the Explorer Database Builder."""

import argparse
import logging
import sys
from typing import Optional

from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.database_writer import DatabaseWriter

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
) -> None:
    """Process a single version and write its data to the database.

    Args:
        version: The version to process
        inventory_manager: Manager for accessing inventory data
        db_writer: Writer for database operations

    Raises:
        ValueError: If no libraries found for the version
        KeyError: If inventory data is malformed
    """
    logger.info(f"Processing Java Agent version: {version}")

    inventory = inventory_manager.load_versioned_inventory(version)

    if "libraries" not in inventory:
        raise KeyError(f"Inventory for version {version} missing 'libraries' key")

    libraries = inventory["libraries"]
    if not libraries:
        raise ValueError(f"No libraries found in inventory for version {version}")

    logger.info(f"Found {len(libraries)} libraries")

    library_map = db_writer.write_libraries(libraries)
    db_writer.write_version_index(version, library_map)


def run_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[DatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the database builder process.

    Args:
        inventory_manager: Optional inventory manager (for testing)
        db_writer: Optional database writer (for testing)
        clean: If True, clean the database directory before building

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        inventory_manager = inventory_manager or InventoryManager()
        db_writer = db_writer or DatabaseWriter()

        if clean:
            db_writer.clean()

        versions = get_release_versions(inventory_manager)
        logger.info(f"Processing {len(versions)} release versions")

        for version in versions:
            process_version(version, inventory_manager, db_writer)

        db_writer.write_version_list(versions)

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)

        logger.info("")
        logger.info("Database Statistics:")
        logger.info(f"  Files written: {stats['files_written']}")
        logger.info(f"  Total size: {stats['total_bytes']:,} bytes ({total_mb:.2f} MB)")
        logger.info("")
        logger.info("✓ Database build completed successfully")
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
