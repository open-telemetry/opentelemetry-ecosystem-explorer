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
"""Inventory management for configuration schema tracking."""

import logging
import shutil
from pathlib import Path

from semantic_version import Version

logger = logging.getLogger(__name__)


class InventoryManager:
    """Manages configuration schema inventory storage and retrieval."""

    def __init__(self, inventory_dir: str = "ecosystem-registry/configuration"):
        """
        Args:
            inventory_dir: Base directory for versioned schema storage
        """
        self.inventory_dir = Path(inventory_dir)

    def get_version_dir(self, version: Version) -> Path:
        """
        Get the directory path for a specific version.

        Args:
            version: Version object

        Returns:
            Path to version directory (with 'v' prefix)
        """
        return self.inventory_dir / f"v{version}"

    def save_versioned_schemas(self, version: Version, source_dir: Path) -> None:
        """
        Save schema files for a specific version by copying from source.

        Args:
            version: Version object
            source_dir: Directory containing schema files to copy
        """
        version_dir = self.get_version_dir(version)
        if version_dir.exists():
            shutil.rmtree(version_dir)
        shutil.copytree(source_dir, version_dir)
        logger.info("Saved schemas for v%s to %s", version, version_dir)

    def list_versions(self) -> list[Version]:
        """
        List all available versions.

        Returns:
            List of versions, sorted newest to oldest
        """
        if not self.inventory_dir.exists():
            return []

        versions = []
        for item in self.inventory_dir.iterdir():
            if item.is_dir():
                try:
                    version = Version(item.name.lstrip("v"))
                    versions.append(version)
                except ValueError:
                    continue

        return sorted(versions, reverse=True)

    def list_snapshot_versions(self) -> list[Version]:
        """
        List all snapshot versions.

        Returns:
            List of snapshot versions
        """
        return [v for v in self.list_versions() if v.prerelease]

    def cleanup_snapshots(self) -> int:
        """
        Remove all snapshot versions.

        Returns:
            Number of snapshot versions removed
        """
        snapshots = self.list_snapshot_versions()
        count = 0

        for snapshot in snapshots:
            snapshot_dir = self.get_version_dir(snapshot)
            if snapshot_dir.exists():
                shutil.rmtree(snapshot_dir)
                count += 1

        return count

    def version_exists(self, version: Version) -> bool:
        """
        Check if a specific version exists.

        Args:
            version: Version to check

        Returns:
            True if version directory exists
        """
        return self.get_version_dir(version).exists()

    def delete_version(self, version: Version) -> bool:
        """
        Delete a specific version directory.

        Args:
            version: Version to delete

        Returns:
            True if version was deleted, False if it didn't exist
        """
        version_dir = self.get_version_dir(version)
        if version_dir.exists():
            shutil.rmtree(version_dir)
            return True
        return False
