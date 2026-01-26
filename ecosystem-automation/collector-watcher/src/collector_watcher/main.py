"""Main entry point for collector watcher."""

import sys

from collector_watcher.collector_sync import CollectorSync
from collector_watcher.inventory_manager import InventoryManager
from collector_watcher.repository_manager import RepositoryManager


def main():
    """Synchronize collector component metadata to the registry."""
    inventory_dir = "ecosystem-registry/collector"

    # Parse optional inventory directory argument
    for arg in sys.argv[1:]:
        if arg.startswith("--inventory-dir="):
            inventory_dir = arg.split("=", 1)[1]

    print("Collector Watcher")
    print(f"Inventory directory: {inventory_dir}")
    print()

    try:
        # Setup repositories
        print("Setting up repositories...")
        manager = RepositoryManager()
        paths = manager.setup_all_repositories()
        print("Repositories ready.")
        print()

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
        print(f"\nError: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
