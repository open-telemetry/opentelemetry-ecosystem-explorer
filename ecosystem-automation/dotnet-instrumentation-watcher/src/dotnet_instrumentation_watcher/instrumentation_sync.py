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
"""Synchronization orchestration for .NET instrumentation metadata."""

import logging
from typing import Any

from semantic_version import Version

from .dotnet_client import DotNetInstrumentationClient
from .inventory_manager import InventoryManager

logger = logging.getLogger(__name__)


class InstrumentationSync:
    """Orchestrates synchronization of .NET instrumentation metadata."""

    def __init__(
        self,
        client: DotNetInstrumentationClient,
        inventory_manager: InventoryManager,
    ):
        """
        Args:
            client: GitHub API client for fetching data
            inventory_manager: Inventory manager for storing data
        """
        self.client = client
        self.inventory_manager = inventory_manager

    def sync(self) -> dict[str, Any]:
        """
        Synchronize .NET instrumentation metadata.

        This will:
        1. Process the latest release (if new)
        2. Update the snapshot from main branch

        Returns:
            Summary dictionary with processing results
        """
        summary = {
            "new_release": None,
            "snapshot_updated": None,
        }

        logger.info("Checking for latest release...")
        new_release = self.process_latest_release()
        if new_release:
            summary["new_release"] = str(new_release)
            logger.info(f"[*] Processed new release: {new_release}")
        else:
            logger.info("[*] Latest release already tracked")

        logger.info("Updating snapshot from main branch...")
        snapshot_version = self.update_snapshot()
        summary["snapshot_updated"] = str(snapshot_version)
        logger.info(f"[*] Updated snapshot: {snapshot_version}")

        return summary

    def process_latest_release(self) -> Version | None:
        """
        Process the latest release if not already tracked.

        Returns:
            Version if newly processed, None if already exists
        """
        tag_string = self.client.get_latest_release_tag()
        logger.info(f"  Latest release tag: {tag_string}")

        clean_tag = tag_string.lstrip("v")
        if "-" in clean_tag:
            clean_tag = clean_tag.split("-")[0]

        try:
            version = Version(clean_tag)
        except ValueError:
            version = Version("1.0.0")

        if self.inventory_manager.version_exists(version):
            return None

        logger.info(f"  Fetching instrumentation list for {tag_string}...")
        instrumentations = self.client.fetch_instrumentation_list(ref=tag_string)

        self.inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        return version

    def update_snapshot(self) -> Version:
        """
        Update snapshot version from main branch.

        This will:
        1. Determine next snapshot version
        2. Fetch from main branch
        3. Clean up old snapshots
        4. Save new snapshot

        Returns:
            The snapshot version
        """
        latest_release_tag = self.client.get_latest_release_tag()
        clean_tag = latest_release_tag.lstrip("v")
        if "-" in clean_tag:
            clean_tag = clean_tag.split("-")[0]

        try:
            latest_release = Version(clean_tag)
        except ValueError:
            latest_release = Version("1.0.0")

        snapshot_version = Version(
            major=latest_release.major,
            minor=latest_release.minor,
            patch=latest_release.patch + 1,
            prerelease=("SNAPSHOT",),
        )

        logger.info("  Fetching instrumentation list from main branch...")
        instrumentations = self.client.fetch_instrumentation_list(ref="main")

        removed = self.inventory_manager.cleanup_snapshots()
        if removed > 0:
            logger.info(f"  Removed {removed} old snapshot(s)")

        self.inventory_manager.save_versioned_inventory(
            version=snapshot_version,
            instrumentations=instrumentations,
        )

        return snapshot_version
