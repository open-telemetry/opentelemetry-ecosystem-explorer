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
"""Configuration schema synchronization to registry."""

import logging
import tempfile
from pathlib import Path
from typing import Any

from semantic_version import Version

from .inventory_manager import InventoryManager
from .schema_copier import SchemaCopier
from .version_detector import VersionDetector

logger = logging.getLogger(__name__)


class ConfigurationSync:
    """
    Synchronizes OpenTelemetry configuration schema files to the registry.

    Handles:
    - Detecting latest release versions
    - Copying schema files from repository checkouts
    - Creating SNAPSHOT versions from main branch
    - Managing inventory storage
    """

    def __init__(
        self,
        repo_path: str | Path,
        inventory_manager: InventoryManager,
    ):
        """
        Args:
            repo_path: Path to the local opentelemetry-configuration repository
            inventory_manager: InventoryManager instance for saving results
        """
        self.repo_path = Path(repo_path)
        self.inventory_manager = inventory_manager
        self.version_detector = VersionDetector(repo_path)
        self.schema_copier = SchemaCopier()

    def copy_schemas_to_inventory(self, version: Version) -> list[str]:
        """
        Copy schema files from the current repo checkout to a versioned inventory directory.

        Args:
            version: Version being processed

        Returns:
            List of copied filenames
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            copied = self.schema_copier.copy_schemas(self.repo_path, tmp_path)
            if copied:
                self.inventory_manager.save_versioned_schemas(version, tmp_path)
            return copied

    def process_latest_release(self) -> Version | None:
        """
        Process the latest release version if not already tracked.

        Returns:
            Latest version if processed, None if already exists or no releases
        """
        latest = self.version_detector.get_latest_release_tag()
        if latest is None:
            logger.info("No releases found")
            return None

        if self.inventory_manager.version_exists(latest):
            logger.info("Version %s already tracked", latest)
            return None

        logger.info("")
        logger.info("Processing new release: %s", latest)

        self.version_detector.checkout_version(latest)
        copied = self.copy_schemas_to_inventory(latest)
        logger.info("  Copied %d schema files", len(copied))

        return latest

    def update_snapshot(self) -> Version:
        """
        Update or create the SNAPSHOT version.

        This:
        1. Cleans up old snapshots
        2. Determines next snapshot version
        3. Checks out main branch
        4. Copies schema files
        5. Saves as new snapshot

        Returns:
            Snapshot version that was created
        """
        logger.info("")
        logger.info("Cleaning up old snapshots...")
        removed = self.inventory_manager.cleanup_snapshots()
        if removed > 0:
            logger.info("  Removed %d old snapshot(s)", removed)

        snapshot_version = self.version_detector.determine_next_snapshot_version()
        logger.info("")
        logger.info("Updating %s...", snapshot_version)

        self.version_detector.checkout_main()
        copied = self.copy_schemas_to_inventory(snapshot_version)
        logger.info("  Copied %d schema files", len(copied))

        return snapshot_version

    def sync(self) -> dict[str, Any]:
        """
        Synchronize configuration schema to the registry.

        This performs the complete sync workflow:
        1. Check for new releases
        2. Process any new release
        3. Update snapshot

        Returns:
            Summary of what was processed
        """
        summary: dict[str, Any] = {
            "new_release": None,
            "snapshot_updated": None,
        }

        logger.info("=" * 60)
        logger.info("CONFIGURATION SCHEMA SYNC")
        logger.info("=" * 60)

        latest = self.process_latest_release()
        if latest:
            summary["new_release"] = str(latest)

        snapshot = self.update_snapshot()
        summary["snapshot_updated"] = str(snapshot)

        logger.info("")
        logger.info("=" * 60)
        logger.info("SYNC COMPLETE")
        logger.info("=" * 60)
        if summary["new_release"]:
            logger.info("New release processed: %s", summary["new_release"])
        else:
            logger.info("No new releases")
        logger.info("Snapshot updated: %s", summary["snapshot_updated"])

        return summary

    def backfill(self, versions: list[Version] | None = None) -> dict[str, Any]:
        """
        Backfill (regenerate) specific versions.

        Args:
            versions: List of versions to backfill, or None to backfill all existing versions

        Returns:
            Summary of backfill operation
        """
        if versions is None:
            versions = self.inventory_manager.list_versions()

        if not versions:
            logger.info("No versions to backfill")
            return {"versions_processed": []}

        logger.info("=" * 60)
        logger.info("BACKFILL MODE")
        logger.info("=" * 60)
        logger.info("Versions to backfill: %d", len(versions))
        for v in versions:
            logger.info("  - %s", v)

        sorted_versions = sorted(versions)
        processed = []

        for version in sorted_versions:
            logger.info("")
            logger.info("Backfilling %s...", version)

            deleted = self.inventory_manager.delete_version(version)
            if deleted:
                logger.info("  Deleted existing data")

            if version.prerelease:
                self.version_detector.checkout_main()
            else:
                self.version_detector.checkout_version(version)

            copied = self.copy_schemas_to_inventory(version)
            logger.info("  Copied %d schema files", len(copied))
            processed.append(str(version))

        logger.info("")
        logger.info("Backfill complete: %d versions processed", len(processed))

        return {"versions_processed": processed}
