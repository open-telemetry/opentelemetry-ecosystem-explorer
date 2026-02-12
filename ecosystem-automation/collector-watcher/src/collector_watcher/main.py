"""Main entry point for collector watcher."""

import argparse
import logging
import sys

from semantic_version import Version

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
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Backfill mode: regenerate existing versions instead of normal sync",
    )
    parser.add_argument(
        "--versions",
        type=str,
        help="Comma-separated list of versions to backfill (e.g., '0.144.0,0.145.0'). "
        "If not specified, all existing versions will be backfilled.",
    )
    parser.add_argument(
        "--distribution",
        type=str,
        choices=["core", "contrib"],
        help="Specific distribution to backfill (core or contrib). "
        "If not specified, all distributions will be processed.",
    )
    args = parser.parse_args()

    logger.info("Collector Watcher")
    logger.info("Inventory directory: %s", args.inventory_dir)

    if args.backfill:
        logger.info("Mode: BACKFILL")
        if args.distribution:
            logger.info("Distribution: %s", args.distribution)
        if args.versions:
            logger.info("Versions: %s", args.versions)
        else:
            logger.info("Versions: auto-detect all existing versions")
    else:
        logger.info("Mode: SYNC")

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

        if args.backfill:
            versions_by_dist = None

            if args.versions:
                version_list = []
                for v_str in args.versions.split(","):
                    v_str = v_str.strip()
                    try:
                        version = Version(v_str)
                        version_list.append(version)
                    except ValueError:
                        logger.error("Invalid version format: %s", v_str)
                        sys.exit(1)

                if args.distribution:
                    versions_by_dist = {args.distribution: version_list}
                else:
                    versions_by_dist = {dist: version_list for dist in dist_config.keys()}
            elif args.distribution:
                versions_by_dist = {args.distribution: None}

            collector_sync.backfill(versions_by_dist)
        else:
            collector_sync.sync()

    except Exception as e:
        logger.error("Error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
