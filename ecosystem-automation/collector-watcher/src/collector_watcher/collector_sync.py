"""Collector metadata synchronization to registry."""

import logging
from typing import Any

from semantic_version import Version

from .component_scanner import ComponentScanner
from .inventory_manager import InventoryManager
from .type_defs import DistributionName
from .version_detector import VersionDetector

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

    def save_version(
        self,
        distribution: DistributionName,
        version: Version,
        components: dict[str, list[dict[str, Any]]],
    ) -> None:
        """
        Save scanned components for a specific version.

        Args:
            distribution: Distribution name
            version: Version being saved
            components: Scanned components
        """
        repository = self.get_repository_name(distribution)
        self.inventory_manager.save_versioned_inventory(
            distribution=distribution,
            version=version,
            components=components,
            repository=repository,
        )
        logger.info("  Saved %s %s", distribution, version)

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

        components = self.scan_version(distribution, latest, checkout=True)
        self.save_version(distribution, latest, components)

        return latest

    def update_snapshot(self, distribution: DistributionName) -> Version:
        """
        Update or create the SNAPSHOT version for a distribution.

        This:
        1. Cleans up old snapshots
        2. Determines next snapshot version
        3. Scans main branch
        4. Saves as new snapshot

        Args:
            distribution: Distribution name

        Returns:
            Snapshot version that was created
        """
        detector = self.version_detectors[distribution]

        logger.info("")
        logger.info("Cleaning up old %s snapshots...", distribution)
        removed = self.inventory_manager.cleanup_snapshots(distribution)
        if removed > 0:
            logger.info("  Removed %d old snapshot(s)", removed)

        snapshot_version = detector.determine_next_snapshot_version()
        logger.info("")
        logger.info("Updating %s %s...", distribution, snapshot_version)

        components = self.scan_version(distribution, snapshot_version, checkout=True)
        self.save_version(distribution, snapshot_version, components)

        return snapshot_version

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

        for distribution in self.repos.keys():
            logger.info("")
            logger.info("=" * 60)
            logger.info("Distribution: %s", distribution.upper())
            logger.info("=" * 60)

            latest = self.process_latest_release(distribution)
            if latest:
                summary["new_releases"].append({"distribution": distribution, "version": str(latest)})

            snapshot = self.update_snapshot(distribution)
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

        processed = []
        for version in versions:
            logger.info("")
            logger.info("Backfilling %s %s...", distribution, version)

            deleted = self.inventory_manager.delete_version(distribution, version)
            if deleted:
                logger.info("  Deleted existing data")

            components = self.scan_version(distribution, version, checkout=True)
            self.save_version(distribution, version, components)
            processed.append(str(version))

        logger.info("")
        logger.info("Backfill complete for %s: %d versions processed", distribution, len(processed))

        return {
            "distribution": distribution,
            "versions_processed": processed,
        }

    def backfill(self, versions_by_dist: dict[DistributionName, list[Version] | None] | None = None) -> dict[str, Any]:
        """
        Backfill versions across all distributions.

        Args:
            versions_by_dist: Dictionary mapping distribution to list of versions to backfill,
                            or None to auto-detect all existing versions for all distributions

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
            result = self.backfill_versions(distribution, versions_by_dist[distribution])
            summary["backfilled"].append(result)

        logger.info("")
        logger.info("=" * 60)
        logger.info("BACKFILL COMPLETE")
        logger.info("=" * 60)
        total_versions = sum(len(item["versions_processed"]) for item in summary["backfilled"])
        logger.info("Total versions backfilled: %d", total_versions)
        for item in summary["backfilled"]:
            logger.info("  %s: %d versions", item["distribution"], len(item["versions_processed"]))

        return summary
