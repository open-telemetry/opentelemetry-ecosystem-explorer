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
import re
from typing import Any

from semantic_version import Version

from .instrumentation_parser import parse_instrumentation_yaml
from .inventory_manager import InventoryManager
from .java_instrumentation_client import GithubAPIError, JavaInstrumentationClient
from .jmx_model_extractor import JmxModelExtractor
from .readme_extractor import ReadmeExtractor

logger = logging.getLogger(__name__)

_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


class InstrumentationSync:
    """Orchestrates synchronization of Java instrumentation metadata."""

    def __init__(
        self,
        client: JavaInstrumentationClient,
        inventory_manager: InventoryManager,
        readme_extractor: ReadmeExtractor | None = None,
        jmx_model_extractor: JmxModelExtractor | None = None,
    ):
        """
        Args:
            client: GitHub API client for fetching data
            inventory_manager: Inventory manager for storing data
            readme_extractor: README extractor (defaults to ReadmeExtractor(client))
            jmx_model_extractor: JMX model extractor (defaults to JmxModelExtractor(client))
        """
        self.client = client
        self.inventory_manager = inventory_manager
        self.readme_extractor = readme_extractor or ReadmeExtractor(client)
        self.jmx_model_extractor = jmx_model_extractor or JmxModelExtractor(client)
        # Set to False in _sync_library_readmes when retryable failures occur or
        # discovery fails. Reset to True at the start of each sync() run.
        self._readme_sync_complete = True

    def sync(self) -> dict[str, Any]:
        """
        Synchronize Java instrumentation metadata.

        This will:
        1. Process the latest release (if new)
        2. Update the snapshot from main branch
        3. Prune orphaned READMEs (only when README sync was complete this run)

        Returns:
            Summary dictionary with processing results
        """
        self._readme_sync_complete = True  # reset per run

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

        if self._readme_sync_complete:
            pruned = self.inventory_manager.prune_orphan_readmes()
            if pruned > 0:
                logger.info(f"  Pruned {pruned} orphaned README file(s) from global library_readmes/")
        else:
            logger.warning("  Skipping orphan README prune: README sync was incomplete this run")

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
            if not self.inventory_manager.readmes_synced(version):
                instrumentations = self.inventory_manager.load_versioned_inventory(version)
                self._sync_library_readmes(version, tag_string, instrumentations)
                self.inventory_manager.save_versioned_inventory(version=version, instrumentations=instrumentations)
            if not self.inventory_manager.jmx_models_index_exists(version):
                self._sync_jmx_models(version, tag_string)
            return None

        logger.info(f"  Fetching instrumentation list for {tag_string}...")
        yaml_content = self.client.fetch_instrumentation_list(ref=tag_string)
        instrumentations = parse_instrumentation_yaml(yaml_content)

        self._sync_library_readmes(version, tag_string, instrumentations)
        self.inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )
        self._sync_jmx_models(version, tag_string)

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

        try:
            main_ref = self.client.resolve_ref_to_sha("main")
        except GithubAPIError:
            logger.warning("  Could not resolve main to SHA; falling back to branch ref")
            main_ref = "main"

        logger.info("  Fetching instrumentation list from main branch...")
        yaml_content = self.client.fetch_instrumentation_list(ref=main_ref)
        instrumentations = parse_instrumentation_yaml(yaml_content)

        removed = self.inventory_manager.cleanup_snapshots()
        if removed > 0:
            logger.info(f"  Removed {removed} old snapshot(s)")

        self._sync_library_readmes(snapshot_version, main_ref, instrumentations)
        self.inventory_manager.save_versioned_inventory(
            version=snapshot_version,
            instrumentations=instrumentations,
        )

        return snapshot_version

    def _sync_library_readmes(
        self,
        version: Version,
        ref: str,
        instrumentations: dict,
    ) -> bool:
        """Best-effort: fetch library READMEs at `ref` and persist content-addressed
        in the global library_readmes/ directory.

        Per-file failures are tracked with a retry counter (MAX_README_FETCH_ATTEMPTS).
        Libraries that exhaust their retries are given up on and do not block the
        'synced' flag. Tree-discovery failure aborts only this step, never the sync.

        Sets self._readme_sync_complete = False when any retryable failures remain,
        to prevent prune_orphan_readmes from running on an incomplete registry state.

        Returns:
            True if all READMEs were successfully fetched (or given up on), False if
            any retryable failures remain.
        """
        try:
            sha = ref if _SHA_RE.match(ref) else self.client.resolve_ref_to_sha(ref)
            discovered = self.readme_extractor.discover_library_readmes(sha)
        except GithubAPIError as e:
            logger.warning(f"  README discovery failed for {ref}: {e}")
            self._readme_sync_complete = False
            return False

        libraries_raw = instrumentations.get("libraries", [])
        # Parsed YAML may keep grouped format {tag: [lib, ...]} or flat list
        if isinstance(libraries_raw, dict):
            libraries = [lib for group in libraries_raw.values() for lib in group]
        else:
            libraries = libraries_raw

        name_by_source = {
            lib["source_path"]: lib["name"] for lib in libraries if lib.get("source_path") and lib.get("name")
        }

        prev_failures = self.inventory_manager.get_readme_failures(version)
        current_failures: dict[str, int] = {}
        fetched: list[tuple[str, str]] = []

        for source_path, blob_path in discovered.items():
            name = name_by_source.get(source_path)
            if not name:
                continue

            attempts = prev_failures.get(name, 0)
            if attempts >= self.inventory_manager.MAX_README_FETCH_ATTEMPTS:
                # Library has been given up on; carry the count forward but don't retry.
                current_failures[name] = attempts
                logger.info(
                    "  Skipping README for %s: reached max fetch attempts (%d)",
                    name,
                    attempts,
                )
                continue

            try:
                content = self.readme_extractor.fetch_readme(blob_path, sha)
                fetched.append((name, content))
            except GithubAPIError as e:
                new_attempts = attempts + 1
                current_failures[name] = new_attempts
                logger.warning(
                    "  Skipping README for %s: %s (attempt %d/%d)",
                    name,
                    e,
                    new_attempts,
                    self.inventory_manager.MAX_README_FETCH_ATTEMPTS,
                )

        written_map = self.inventory_manager.save_library_readmes(fetched)

        for lib in libraries:
            if lib.get("name") in written_map:
                lib["readme"] = written_map[lib["name"]]

        logger.info(f"  Stored {len(written_map)} library README(s) for v{version}")

        self.inventory_manager.record_readme_sync(version, current_failures)

        # Retryable failures keep _readme_sync_complete False to gate pruning.
        retryable = any(count < self.inventory_manager.MAX_README_FETCH_ATTEMPTS for count in current_failures.values())
        if retryable:
            self._readme_sync_complete = False
            return False

        return True

    def _sync_jmx_models(self, version: Version, ref: str) -> None:
        """Best-effort: fetch JMX weaver model files and write version index."""
        try:
            sha = ref if _SHA_RE.match(ref) else self.client.resolve_ref_to_sha(ref)
            discovered_models, manifest_path = self.jmx_model_extractor.discover_jmx_model_paths(sha)
        except GithubAPIError as e:
            logger.warning(f"  JMX model discovery failed for {ref}: {e}")
            return

        if not discovered_models and manifest_path is None:
            logger.info(f"  No JMX weaver model files found at {ref}")
            return

        models: dict[str, str] = {}
        fetch_failed = False
        for target_system, path in sorted(discovered_models.items()):
            try:
                models[target_system] = self.jmx_model_extractor.fetch_model(path, sha)
            except GithubAPIError as e:
                logger.warning(f"  JMX model fetch failed for {target_system}: {e}")
                fetch_failed = True

        manifest_content = None
        if manifest_path is not None:
            try:
                manifest_content = self.jmx_model_extractor.fetch_model(manifest_path, sha)
            except GithubAPIError as e:
                logger.warning(f"  JMX manifest fetch failed: {e}")
                fetch_failed = True

        if fetch_failed:
            logger.warning(f"  JMX model index not written for v{version}; fetch incomplete")
            return

        written_models, manifest_file = self.inventory_manager.save_jmx_models_index(
            version=version,
            models=models,
            manifest=manifest_content,
        )

        suffix = " and manifest" if manifest_file else ""
        logger.info(f"  Stored {len(written_models)} JMX model file(s){suffix} for v{version}")
