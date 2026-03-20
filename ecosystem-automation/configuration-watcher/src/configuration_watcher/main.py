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
"""Main entry point for configuration watcher."""

import argparse
import logging
import sys

from semantic_version import Version

from configuration_watcher.configuration_sync import ConfigurationSync
from configuration_watcher.inventory_manager import InventoryManager
from configuration_watcher.repository_manager import RepositoryManager

logger = logging.getLogger(__name__)


def configure_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def main():
    """Synchronize configuration schema files to the registry."""
    configure_logging()

    parser = argparse.ArgumentParser(
        description="Synchronize OpenTelemetry configuration schema files to the registry",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--inventory-dir",
        default="ecosystem-registry/configuration",
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
        help="Comma-separated list of versions to backfill (e.g., '1.0.0,0.4.0'). "
        "If not specified, all existing versions will be backfilled.",
    )
    args = parser.parse_args()

    logger.info("Configuration Watcher")
    logger.info("Inventory directory: %s", args.inventory_dir)

    if args.backfill:
        logger.info("Mode: BACKFILL")
        if args.versions:
            logger.info("Versions: %s", args.versions)
        else:
            logger.info("Versions: auto-detect all existing versions")
    else:
        logger.info("Mode: SYNC")

    logger.info("")

    try:
        logger.info("Setting up repository...")
        repo_manager = RepositoryManager()
        repo_path = repo_manager.setup_repository()
        logger.info("Repository ready.")
        logger.info("")

        inventory_manager = InventoryManager(args.inventory_dir)
        config_sync = ConfigurationSync(
            repo_path=str(repo_path),
            inventory_manager=inventory_manager,
        )

        if args.backfill:
            version_list = None

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

            config_sync.backfill(version_list)
        else:
            config_sync.sync()

    except Exception as e:
        logger.error("Error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
