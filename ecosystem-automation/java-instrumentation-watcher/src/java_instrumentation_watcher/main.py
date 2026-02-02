"""Main entry point for java instrumentation watcher."""

import argparse
import logging
import sys

from .instrumentation_sync import InstrumentationSync
from .inventory_manager import InventoryManager
from .java_instrumentation_client import JavaInstrumentationClient

logger = logging.getLogger(__name__)


def configure_logging():
    """Configure logging to output to stdout."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def main():
    """Synchronize java instrumentation metadata to the registry."""
    configure_logging()

    parser = argparse.ArgumentParser(
        description="Synchronize java instrumentation metadata to the registry",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--inventory-dir",
        default="ecosystem-registry/java/javaagent",
        help="Directory path for the inventory",
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Java Instrumentation Watcher")
    logger.info("=" * 60)
    logger.info(f"Inventory directory: {args.inventory_dir}")
    logger.info("")

    try:
        client = JavaInstrumentationClient()
        inventory_manager = InventoryManager(inventory_dir=args.inventory_dir)

        sync = InstrumentationSync(client, inventory_manager)
        summary = sync.sync()

        logger.info("")
        logger.info("=" * 60)
        logger.info("Sync Summary")
        logger.info("=" * 60)
        if summary["new_release"]:
            logger.info(f"✓ New release processed: {summary['new_release']}")
        else:
            logger.info("✓ No new releases")
        logger.info(f"✓ Snapshot updated: {summary['snapshot_updated']}")
        logger.info("")

    except Exception as e:
        logger.exception(f"Failed to sync: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
