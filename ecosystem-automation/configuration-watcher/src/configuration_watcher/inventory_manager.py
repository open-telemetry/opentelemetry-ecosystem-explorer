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
from watcher_common.inventory_manager import BaseInventoryManager

logger = logging.getLogger(__name__)


class InventoryManager(BaseInventoryManager):
    """Manages configuration schema inventory storage and retrieval."""

    def __init__(self, inventory_dir: str = "ecosystem-registry/configuration"):
        """
        Args:
            inventory_dir: Base directory for versioned schema storage
        """
        super().__init__(inventory_dir)

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

    def cleanup_snapshots_except(self, keep: Version) -> int:
        """
        Remove all snapshot versions except the given one.

        Snapshot cleanup must run only after a replacement snapshot has been written, so this
        preserves `keep` (the freshly written snapshot) while removing any stale ones.

        Args:
            keep: Snapshot version to preserve

        Returns:
            Number of snapshot versions removed
        """
        removed = 0
        for snapshot in self.list_snapshot_versions():
            if snapshot == keep:
                continue
            snapshot_dir = self.get_version_dir(snapshot)
            if snapshot_dir.exists():
                shutil.rmtree(snapshot_dir)
                removed += 1
        return removed
