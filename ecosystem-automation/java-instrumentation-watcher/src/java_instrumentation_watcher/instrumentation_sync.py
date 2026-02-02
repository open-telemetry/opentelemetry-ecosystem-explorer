"""Synchronization orchestration for Java instrumentation metadata."""

import logging
from typing import Any

from semantic_version import Version

from .instrumentation_parser import parse_instrumentation_yaml
from .inventory_manager import InventoryManager
from .java_instrumentation_client import JavaInstrumentationClient

logger = logging.getLogger(__name__)


class InstrumentationSync:
    """Orchestrates synchronization of Java instrumentation metadata."""

    def __init__(
        self,
        client: JavaInstrumentationClient,
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
        Synchronize Java instrumentation metadata.

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
            logger.info(f"✓ Processed new release: {new_release}")
        else:
            logger.info("✓ Latest release already tracked")

        logger.info("Updating snapshot from main branch...")
        snapshot_version = self.update_snapshot()
        summary["snapshot_updated"] = str(snapshot_version)
        logger.info(f"✓ Updated snapshot: {snapshot_version}")

        return summary

    def process_latest_release(self) -> Version | None:
        """
        Process the latest release if not already tracked.

        Returns:
            Version if newly processed, None if already exists
        """
        tag_string = self.client.get_latest_release_tag()
        logger.info(f"  Latest release tag: {tag_string}")

        version = Version(tag_string.lstrip("v"))

        if self.inventory_manager.version_exists(version):
            return None

        logger.info(f"  Fetching instrumentation list for {tag_string}...")
        yaml_content = self.client.fetch_instrumentation_list(ref=tag_string)
        instrumentations = parse_instrumentation_yaml(yaml_content)

        self.inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        return version

    def update_snapshot(self) -> Version:
        """
        Update snapshot version from main branch.

        This will:
        1. Clean up old snapshots
        2. Determine next snapshot version
        3. Fetch from main branch
        4. Save new snapshot

        Returns:
            The snapshot version
        """
        removed = self.inventory_manager.cleanup_snapshots()
        if removed > 0:
            logger.info(f"  Removed {removed} old snapshot(s)")

        latest_release_tag = self.client.get_latest_release_tag()
        latest_release = Version(latest_release_tag.lstrip("v"))

        # Create snapshot version (increment patch)
        snapshot_version = Version(
            major=latest_release.major,
            minor=latest_release.minor,
            patch=latest_release.patch + 1,
            prerelease=("SNAPSHOT",),
        )

        logger.info("  Fetching instrumentation list from main branch...")
        yaml_content = self.client.fetch_instrumentation_list(ref="main")
        instrumentations = parse_instrumentation_yaml(yaml_content)

        self.inventory_manager.save_versioned_inventory(
            version=snapshot_version,
            instrumentations=instrumentations,
        )

        return snapshot_version
