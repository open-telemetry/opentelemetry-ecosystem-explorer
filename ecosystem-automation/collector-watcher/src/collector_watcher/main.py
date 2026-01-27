"""Main entry point for collector watcher."""

import argparse
import logging
import sys

from collector_watcher.collector_sync import CollectorSync
from collector_watcher.inventory_manager import InventoryManager
from collector_watcher.repository_manager import RepositoryManager

logger = logging.getLogger(__name__)


def configure_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def main():
    """Synchronize collector component metadata to the registry."""
    configure_logging()

    parser = argparse.ArgumentParser(
        description="Synchronize collector component metadata to the registry",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--inventory-dir",
        default="ecosystem-registry/collector",
        help="Directory path for the inventory",
    )
    args = parser.parse_args()

    logger.info("Collector Watcher")
    logger.info("Inventory directory: %s", args.inventory_dir)
    logger.info("")

    try:
        # Setup repositories
        logger.info("Setting up repositories...")
        manager = RepositoryManager()
        paths = manager.setup_all_repositories()
        logger.info("Repositories ready.")
        logger.info("")

        # Build distribution config
        dist_config = {
            "core": str(paths["core"]),
            "contrib": str(paths["contrib"]),
        }

        # Create inventory manager and collector sync
        inventory_manager = InventoryManager(args.inventory_dir)
        collector_sync = CollectorSync(
            repos=dist_config,
            inventory_manager=inventory_manager,
        )

        # Run sync
        collector_sync.sync()

    except Exception as e:
        logger.error("Error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
