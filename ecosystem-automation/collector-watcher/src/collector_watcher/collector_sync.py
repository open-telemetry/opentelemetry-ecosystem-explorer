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
"""Collector metadata synchronization to registry."""

import logging
from typing import Any

from semantic_version import Version
from watcher_common.version_detector import VersionDetector

from .component_scanner import ComponentScanner
from .deprecation_detector import DeprecationDetector
from .inventory_manager import InventoryManager
from .readme_scanner import discover_component_readmes
from .schema_copier import SCHEMA_RELATIVE_PATH, UNKNOWN_HASH, CollectorSchemaCopier
from .type_defs import COMPONENT_TYPES, DistributionName

logger = logging.getLogger(__name__)

DistributionConfig = dict[DistributionName, str]


class CollectorSync:
    """
    Synchronizes OpenTelemetry Collector component metadata to the registry.

    Handles:
    - Detecting latest release versions
    - Scanning component metadata from repositories
    - Creating SNAPSHOT versions from main branch
    - Managing inventory storage
    """

    def __init__(
        self,
        repos: DistributionConfig,
        inventory_manager: InventoryManager,
    ):
        """
        Initialize the collector sync.

        Args:
            repos: Dict mapping distribution name to local repo path
                   e.g., {"core": "/path/to/collector", "contrib": "/path/to/collector-contrib"}
            inventory_manager: InventoryManager instance for saving results
        """
        self.repos = repos
        self.inventory_manager = inventory_manager
        self.version_detectors = {dist: VersionDetector(path) for dist, path in repos.items()}
        self.schema_copier = CollectorSchemaCopier()
        self.deprecation_detector = DeprecationDetector()
        self.deprecations = inventory_manager.load_deprecations()
        self.previous_versions: dict[DistributionName, Version | None] = {}
        self.previous_components: dict[DistributionName, dict[str, list[dict[str, Any]]]] = {}
        # Cache of core release tags for the lifetime of the sync run. get_all_release_tags()
        # shells out to `git tag --list`, and _core_schema_refs() is called once per version;
        # caching avoids an extra git process per saved version during a backfill.
        self._core_release_tags: list[Version] | None = None

    @staticmethod
    def get_repository_name(distribution: DistributionName) -> str:
        """
        Get the canonical repository name for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            Repository name
        """
        if distribution == "core":
            return "opentelemetry-collector"
        elif distribution == "contrib":
            return "opentelemetry-collector-contrib"
        else:
            return f"opentelemetry-collector-{distribution}"

    def scan_version(
        self,
        distribution: DistributionName,
        version: Version,
        checkout: bool = True,
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Scan a specific version of a distribution.

        Args:
            distribution: Distribution name
            version: Version to scan
            checkout: Whether to checkout the version tag (default: True)

        Returns:
            Dictionary of component type to component list
        """
        repo_path = self.repos[distribution]
        detector = self.version_detectors[distribution]

        if checkout and not version.prerelease:
            logger.info("  Checking out %s %s...", distribution, version)
            detector.checkout_version(version)
        elif checkout and version.prerelease:
            logger.info("  Checking out %s main branch...", distribution)
            detector.checkout_main()

        logger.info("  Scanning %s %s...", distribution, version)
        scanner = ComponentScanner(repo_path)
        components = scanner.scan_all_components()

        total = sum(len(comps) for comps in components.values())
        logger.info("    Found %d components", total)

        return components

    def _create_enriched_copy(
        self,
        components: dict[str, list[dict[str, Any]]],
        repository: str,
        distribution: DistributionName,
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Create an enriched copy of components for deprecation detection.

        Creates a deep copy and adds:
        - source_repo: Repository name
        - distributions: Flattened from metadata.status.distributions

        Args:
            components: Components dictionary to copy and enrich
            repository: Repository name
            distribution: Distribution name

        Returns:
            Enriched copy of components
        """
        import copy

        enriched = copy.deepcopy(components)

        for component_list in enriched.values():
            for component in component_list:
                component["source_repo"] = repository

                distributions = None
                if "metadata" in component:
                    status = component["metadata"].get("status", {})
                    distributions = status.get("distributions")

                component["distributions"] = list(distributions) if distributions else []

        return enriched

    def save_version(
        self,
        distribution: DistributionName,
        version: Version,
        components: dict[str, list[dict[str, Any]]],
    ) -> None:
        """
        Save scanned components for a specific version.

        Stores the upstream schema in content-addressable storage at
        ``meta/schemas/{hash}.yaml`` (deduplicated across versions and
        distributions) and records that hash in every component YAML for
        drift detection and parser routing.

        Also discovers and stores each component's README.md, if present,
        content-addressed under ``component_readmes/``. README publishing
        is best-effort: a failure here is logged and does not fail the sync.
        This always runs after the inventory write below, never before -
        see the comment at that call site for why the order matters.

        Schema is always read from the core repo: ``mdatagen`` lives only in
        ``opentelemetry-collector``, and the schema is identical across
        distributions, so contrib carries the same ``schema_hash`` as core.

        Registry layout after this call:
            ecosystem-registry/collector/
                {distribution}/v{version}/*.yaml               (component data, each with schema_hash)
                {distribution}/v{version}/component_readmes/    (one file per distinct README content)
                meta/schemas/{hash}.yaml                        (one file per distinct schema)

        Args:
            distribution: Distribution name
            version: Version being saved
            components: Scanned components
        """
        schema_hash = self._resolve_schema_hash(version)

        repository = self.get_repository_name(distribution)
        self.inventory_manager.save_versioned_inventory(
            distribution=distribution,
            version=version,
            components=components,
            repository=repository,
            schema_hash=schema_hash,
        )

        # Readme discovery/save runs after the critical inventory write, not
        # before: save_versioned_inventory() is what version_exists() treats
        # as the "this version is tracked" signal, since it just checks
        # whether the version directory exists. If readme saving (which also
        # mkdirs that directory as a side effect of writing into it) ran
        # first and the process crashed before save_versioned_inventory
        # completed, version_exists() would incorrectly report the version
        # as already tracked despite zero real component data ever being
        # written - causing process_latest_release() to skip it forever.
        repo_path = self.repos[distribution]
        try:
            readmes = discover_component_readmes(repo_path, components)
            written = self.inventory_manager.save_component_readmes(distribution, version, readmes.items())
            if written:
                logger.info("  Saved %d component README(s)", written)
        except OSError as e:
            # README publishing is best-effort and must never fail the sync -
            # the component inventory itself is the critical data.
            logger.warning("  Failed to save component READMEs for %s %s: %s", distribution, version, e)

        logger.info("  Saved %s %s (schema_hash=%s)", distribution, version, schema_hash)

    def _resolve_schema_hash(self, version: Version) -> str:
        """Store and return the core schema hash for ``version``.

        ``mdatagen`` lives only in core, so every distribution records the core
        schema at its version. The schema is read from the core repo at that
        version's git ref, not the clone's current checkout — a backfill leaves
        the core clone on ``main``, which would otherwise stamp every version
        with the latest schema. Falls back through ``_core_schema_refs`` (with a
        warning) and returns ``UNKNOWN_HASH`` if no ref yields the schema.
        """
        core = self.version_detectors["core"]
        schemas_dir = self.inventory_manager.meta_schemas_dir()

        candidate_refs = self._core_schema_refs(version)
        for index, ref in enumerate(candidate_refs):
            content = core.read_file_at_ref(ref, SCHEMA_RELATIVE_PATH)
            if content is None:
                continue
            if index > 0:
                logger.warning(
                    "Core schema not found at %s for %s; using %s instead",
                    candidate_refs[0],
                    version,
                    ref,
                )
            stored = self.schema_copier.store_schema_content(content, schemas_dir)
            return stored if stored is not None else UNKNOWN_HASH

        logger.warning(
            "No core schema found for %s (tried: %s); recording %s",
            version,
            ", ".join(candidate_refs),
            UNKNOWN_HASH,
        )
        return UNKNOWN_HASH

    def _core_schema_refs(self, version: Version) -> list[str]:
        """Ordered core refs to try for ``version``'s schema: exact tag, then the
        nearest earlier core release (for versions core never tagged), then
        ``main``. Prereleases (SNAPSHOTs) are built from ``main`` only.
        """
        if version.prerelease:
            return ["main"]

        if self._core_release_tags is None:
            self._core_release_tags = self.version_detectors["core"].get_all_release_tags()

        refs = [f"v{version}"]
        earlier = [v for v in self._core_release_tags if not v.prerelease and v < version]
        if earlier:
            refs.append(f"v{max(earlier)}")
        refs.append("main")
        return refs

    def initialize_previous_version(self, distribution: DistributionName) -> None:
        """
        Initialize previous version tracking for deprecation detection.

        Loads the latest existing release version as the "previous" version
        for tracking what components existed before. Excludes prerelease/SNAPSHOT
        versions to ensure deprecations are tracked between stable releases.

        Args:
            distribution: Distribution name
        """
        if distribution in self.previous_versions:
            return

        existing_versions = self.inventory_manager.list_release_versions(distribution)
        if existing_versions:
            latest = existing_versions[0]
            logger.debug("Initializing previous version for %s: %s", distribution, latest)
            inventory = self.inventory_manager.load_versioned_inventory(distribution, latest)
            self.previous_versions[distribution] = latest
            self.previous_components[distribution] = inventory.get("components", {})
        else:
            logger.debug("No previous versions found for %s", distribution)
            self.previous_versions[distribution] = None
            self.previous_components[distribution] = {}

    def detect_and_track_deprecations(
        self,
        distribution: DistributionName,
        current_version: Version,
        current_components: dict[str, list[dict[str, Any]]],
    ) -> None:
        """
        Detect deprecations for the current version and update the index.

        Only tracks deprecations for official releases, not snapshots.
        The baseline (previous_versions/previous_components) is only updated
        for releases to ensure release-to-release comparison.

        Args:
            distribution: Distribution name
            current_version: Current version being processed
            current_components: Components from current version
        """
        previous_version = self.previous_versions.get(distribution)
        previous_components = self.previous_components.get(distribution, {})

        repository = self.get_repository_name(distribution)

        enriched_current = self._create_enriched_copy(current_components, repository, distribution)
        enriched_previous = self._create_enriched_copy(previous_components, repository, distribution)

        deprecated = self.deprecation_detector.detect_deprecated(
            previous_version=previous_version,
            previous_components=enriched_previous,
            current_version=current_version,
            current_components=enriched_current,
        )

        if current_version.prerelease:
            deprecated_count = sum(len(components) for components in deprecated.values())
            if deprecated_count > 0:
                logger.debug(
                    "Skipping deprecation tracking for prerelease %s: %d component(s) removed",
                    current_version,
                    deprecated_count,
                )
        else:
            self.inventory_manager.add_deprecated_components(self.deprecations, distribution, deprecated)
            self.previous_versions[distribution] = current_version
            self.previous_components[distribution] = current_components

    def process_latest_release(self, distribution: DistributionName) -> Version | None:
        """
        Process the latest release version if not already tracked.

        Args:
            distribution: Distribution name

        Returns:
            Latest version if processed, None if already exists or no releases
        """
        detector = self.version_detectors[distribution]

        latest = detector.get_latest_release_tag()
        if latest is None:
            logger.info("No releases found for %s", distribution)
            return None

        if self.inventory_manager.version_exists(distribution, latest):
            logger.info("Version %s %s already tracked", distribution, latest)
            return None

        logger.info("")
        logger.info("Processing new release: %s %s", distribution, latest)

        self.initialize_previous_version(distribution)
        components = self.scan_version(distribution, latest, checkout=True)
        self.save_version(distribution, latest, components)
        self.detect_and_track_deprecations(distribution, latest, components)

        return latest

    def update_snapshot(self, distribution: DistributionName) -> Version:
        """
        Update or create the SNAPSHOT version for a distribution.

        This:
        1. Determines next snapshot version
        2. Scans main branch
        3. Cleans up old snapshots
        4. Saves as new snapshot

        Args:
            distribution: Distribution name

        Returns:
            Snapshot version that was created
        """
        detector = self.version_detectors[distribution]

        snapshot_version = detector.determine_next_snapshot_version()
        logger.info("")
        logger.info("Updating %s %s...", distribution, snapshot_version)

        self.initialize_previous_version(distribution)
        components = self.scan_version(distribution, snapshot_version, checkout=True)

        logger.info("")
        logger.info("Cleaning up old %s snapshots...", distribution)
        removed = self.inventory_manager.cleanup_snapshots(distribution)
        if removed > 0:
            logger.info("  Removed %d old snapshot(s)", removed)

        self.save_version(distribution, snapshot_version, components)
        self.detect_and_track_deprecations(distribution, snapshot_version, components)

        return snapshot_version

    def _process_distribution_sync(self, distribution: DistributionName) -> tuple[Version | None, Version]:
        latest = self.process_latest_release(distribution)

        snapshot = self.update_snapshot(distribution)

        return (latest, snapshot)

    def sync(self) -> dict[str, Any]:
        """
        Synchronize collector metadata to the registry.

        This performs the complete sync workflow:
        1. Check for new releases in each distribution
        2. Process any new releases
        3. Update snapshots for each distribution

        Returns:
            Summary of what was processed
        """
        summary = {
            "new_releases": [],
            "snapshots_updated": [],
        }

        logger.info("=" * 60)
        logger.info("COLLECTOR METADATA SYNC")
        logger.info("=" * 60)
        distribution_results = {}
        try:
            for distribution in self.repos.keys():
                logger.info("")
                logger.info("=" * 60)
                logger.info("Distribution: %s", distribution.upper())
                logger.info("=" * 60)

                latest, snapshot = self._process_distribution_sync(distribution)
                distribution_results[distribution] = (latest, snapshot)

        except Exception as e:
            logger.error("Error processing distributions: %s", e)
            raise

        for distribution, (latest, snapshot) in distribution_results.items():
            if latest:
                summary["new_releases"].append({"distribution": distribution, "version": str(latest)})
            summary["snapshots_updated"].append({"distribution": distribution, "version": str(snapshot)})

        logger.info("")
        logger.info("=" * 60)
        logger.info("SYNC COMPLETE")
        logger.info("=" * 60)
        logger.info("New releases processed: %d", len(summary["new_releases"]))
        for item in summary["new_releases"]:
            logger.info("  - %s: %s", item["distribution"], item["version"])
        logger.info("Snapshots updated: %d", len(summary["snapshots_updated"]))
        for item in summary["snapshots_updated"]:
            logger.info("  - %s: %s", item["distribution"], item["version"])

        self.inventory_manager.save_deprecations(self.deprecations)

        return summary

    def backfill_versions(
        self,
        distribution: DistributionName,
        versions: list[Version] | None = None,
    ) -> dict[str, Any]:
        """
        Backfill (regenerate) specific versions for a distribution.

        This deletes existing version data and re-scans from the repository.
        Useful when scanner logic changes (e.g., new exclusions) and you want to
        apply changes to historical versions.

        Args:
            distribution: Distribution name
            versions: List of versions to backfill, or None to backfill all existing versions

        Returns:
            Summary of versions that were backfilled
        """
        if versions is None:
            versions = self.inventory_manager.list_versions(distribution)

        if not versions:
            logger.info("No versions to backfill for %s", distribution)
            return {"distribution": distribution, "versions_processed": []}

        logger.info("")
        logger.info("=" * 60)
        logger.info("BACKFILL MODE: %s", distribution.upper())
        logger.info("=" * 60)
        logger.info("Versions to backfill: %d", len(versions))
        for v in versions:
            logger.info("  - %s", v)

        sorted_versions = sorted(versions)
        self.previous_versions[distribution] = None
        self.previous_components[distribution] = {}

        processed = []
        for version in sorted_versions:
            logger.info("")
            logger.info("Backfilling %s %s...", distribution, version)

            deleted = self.inventory_manager.delete_version(distribution, version)
            if deleted:
                logger.info("  Deleted existing data")

            components = self.scan_version(distribution, version, checkout=True)
            self.save_version(distribution, version, components)
            self.detect_and_track_deprecations(distribution, version, components)
            processed.append(str(version))

        logger.info("")
        logger.info("Backfill complete for %s: %d versions processed", distribution, len(processed))

        return {
            "distribution": distribution,
            "versions_processed": processed,
        }

    def backfill(
        self,
        versions_by_dist: dict[DistributionName, list[Version] | None] | None = None,
        prune_unlisted: bool = False,
    ) -> dict[str, Any]:
        """
        Backfill versions across all distributions.

        Args:
            versions_by_dist: Dictionary mapping distribution to list of versions to backfill,
                            or None to auto-detect all existing versions for all distributions
            prune_unlisted: When True, delete existing release versions not in the provided
                            list for each distribution before backfilling. Requires an explicit
                            version list per distribution (distributions mapped to None are left
                            untouched). SNAPSHOT versions are always kept.

        Returns:
            Summary of backfill operation
        """
        if versions_by_dist is None:
            versions_by_dist = {dist: None for dist in self.repos.keys()}

        summary = {"backfilled": []}

        logger.info("=" * 60)
        logger.info("BACKFILL MODE")
        logger.info("=" * 60)

        for distribution in versions_by_dist.keys():
            keep = versions_by_dist[distribution]
            if prune_unlisted and keep is not None:
                # Reset this distribution's deprecation index so it is recomputed cleanly over
                # only the surviving versions. Otherwise entries referencing now-deleted versions
                # would linger in deprecations.yaml (backfill_versions appends, never clears).
                self.deprecations[distribution] = {component_type: [] for component_type in COMPONENT_TYPES}
                removed = self.inventory_manager.prune_release_versions_not_in(distribution, keep)
                if removed:
                    logger.info("Pruned %d unlisted release version(s) from %s", removed, distribution)
            result = self.backfill_versions(distribution, keep)
            summary["backfilled"].append(result)

        logger.info("")
        logger.info("=" * 60)
        logger.info("BACKFILL COMPLETE")
        logger.info("=" * 60)
        total_versions = sum(len(item["versions_processed"]) for item in summary["backfilled"])
        logger.info("Total versions backfilled: %d", total_versions)
        for item in summary["backfilled"]:
            logger.info("  %s: %d versions", item["distribution"], len(item["versions_processed"]))

        self.inventory_manager.save_deprecations(self.deprecations)

        return summary
