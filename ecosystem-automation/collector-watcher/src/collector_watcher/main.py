"""Main entry point for collector watcher."""

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

    inventory_dir = "ecosystem-registry/collector"

    # Parse optional inventory directory argument
    for arg in sys.argv[1:]:
        if arg.startswith("--inventory-dir="):
            inventory_dir = arg.split("=", 1)[1]

    logger.info("Collector Watcher")
    logger.info("Inventory directory: %s", inventory_dir)
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
        inventory_manager = InventoryManager(inventory_dir)
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
