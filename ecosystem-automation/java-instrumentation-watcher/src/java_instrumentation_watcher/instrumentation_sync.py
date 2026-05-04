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
"""Synchronization orchestration for Java instrumentation metadata."""

import logging
from typing import Any

from semantic_version import Version

from .instrumentation_parser import parse_instrumentation_yaml
from .inventory_manager import InventoryManager
from .java_instrumentation_client import GithubAPIError, JavaInstrumentationClient
from .readme_extractor import ReadmeExtractor

logger = logging.getLogger(__name__)


class InstrumentationSync:
    """Orchestrates synchronization of Java instrumentation metadata."""

    def __init__(
        self,
        client: JavaInstrumentationClient,
        inventory_manager: InventoryManager,
        readme_extractor: ReadmeExtractor | None = None,
    ):
        """
        Args:
            client: GitHub API client for fetching data
            inventory_manager: Inventory manager for storing data
            readme_extractor: README extractor (defaults to ReadmeExtractor(client))
        """
        self.client = client
        self.inventory_manager = inventory_manager
        self.readme_extractor = readme_extractor or ReadmeExtractor(client)

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
        self._sync_library_readmes(version, tag_string, instrumentations)

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

        removed = self.inventory_manager.cleanup_snapshots()
        if removed > 0:
            logger.info(f"  Removed {removed} old snapshot(s)")

        self.inventory_manager.save_versioned_inventory(
            version=snapshot_version,
            instrumentations=instrumentations,
        )
        self._sync_library_readmes(snapshot_version, "main", instrumentations)

        return snapshot_version

    def _sync_library_readmes(
        self,
        version: Version,
        ref: str,
        instrumentations: dict,
    ) -> None:
        """Best-effort: fetch library READMEs at `ref` and persist content-addressed.

        Per-file failures are logged and skipped; tree-discovery failure aborts
        only this step, never the sync.
        """
        try:
            sha = self.client.resolve_ref_to_sha(ref)
            discovered = self.readme_extractor.discover_library_readmes(sha)
        except GithubAPIError as e:
            logger.warning(f"  README discovery failed for {ref}: {e}")
            return

        name_by_source = {
            lib["source_path"]: lib["name"]
            for lib in instrumentations.get("libraries", [])
            if lib.get("source_path") and lib.get("name")
        }

        fetched: list[tuple[str, str]] = []
        for source_path, blob_path in discovered.items():
            name = name_by_source.get(source_path)
            if not name:
                continue
            try:
                content = self.readme_extractor.fetch_readme(blob_path, sha)
                fetched.append((name, content))
            except GithubAPIError as e:
                logger.warning(f"  Skipping README for {name}: {e}")

        written = self.inventory_manager.save_library_readmes(version, fetched)
        logger.info(f"  Stored {written} library README(s) for v{version}")
