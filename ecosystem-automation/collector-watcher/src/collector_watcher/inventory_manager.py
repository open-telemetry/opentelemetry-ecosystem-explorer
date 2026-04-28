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
"""Inventory management for component tracking."""

import logging
import shutil
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version

from .type_defs import COMPONENT_TYPES, DistributionName

logger = logging.getLogger(__name__)


class InventoryManager:
    """Manages component inventory storage and retrieval."""

    def __init__(self, inventory_dir: str = "ecosystem-registry/collector"):
        """
        Args:
            inventory_dir: Base directory for versioned metadata
        """
        self.inventory_dir = Path(inventory_dir)

    def get_version_dir(self, distribution: DistributionName, version: Version) -> Path:
        """
        Get the directory path for a specific distribution and version.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version object

        Returns:
            Path to version directory (with 'v' prefix)
        """
        return self.inventory_dir / distribution / f"v{version}"

    def save_versioned_inventory(
        self,
        distribution: DistributionName,
        version: Version,
        components: dict[str, list[dict[str, Any]]],
        repository: str,
    ) -> None:
        """
        Save inventory for a specific distribution and version.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version object
            components: Dictionary of component type to component list
            repository: Name of the repository being scanned
        """
        version_dir = self.get_version_dir(distribution, version)
        version_dir.mkdir(parents=True, exist_ok=True)

        for component_type in COMPONENT_TYPES:
            component_list = components.get(component_type, [])
            file_path = version_dir / f"{component_type}.yaml"

            component_data = {
                "distribution": distribution,
                "version": str(version),
                "repository": repository,
                "component_type": component_type,
                "components": component_list,
            }

            with open(file_path, "w", encoding="utf-8") as f:
                yaml.dump(component_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    def load_versioned_inventory(self, distribution: DistributionName, version: Version) -> dict[str, Any]:
        """
        Load inventory for a specific distribution and version.

        Args:
            distribution: Distribution name
            version: Version object

        Returns:
            Inventory dictionary with all components, or empty structure if it doesn't exist
        """
        version_dir = self.get_version_dir(distribution, version)

        if not version_dir.exists():
            return {"distribution": distribution, "version": str(version), "components": {}}

        components = {}
        repository = ""

        for component_type in COMPONENT_TYPES:
            file_path = version_dir / f"{component_type}.yaml"

            if file_path.exists():
                with open(file_path, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                    components[component_type] = data.get("components", [])
                    if not repository:
                        repository = data.get("repository", "")
            else:
                components[component_type] = []

        return {
            "distribution": distribution,
            "version": str(version),
            "repository": repository,
            "components": components,
        }

    def list_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all available versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of versions, sorted newest to oldest
        """
        dist_dir = self.inventory_dir / distribution
        if not dist_dir.exists():
            return []

        versions = []
        for item in dist_dir.iterdir():
            if item.is_dir():
                try:
                    version = Version(item.name.lstrip("v"))
                    versions.append(version)
                except ValueError:
                    continue

        return sorted(versions, reverse=True)

    def list_snapshot_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all snapshot versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of snapshot versions
        """
        all_versions = self.list_versions(distribution)
        return [v for v in all_versions if v.prerelease]

    def list_release_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all release (non-prerelease) versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of release versions, sorted newest to oldest
        """
        all_versions = self.list_versions(distribution)
        return [v for v in all_versions if not v.prerelease]

    def cleanup_snapshots(self, distribution: DistributionName) -> int:
        """
        Remove all snapshot versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            Number of snapshot versions removed
        """
        snapshots = self.list_snapshot_versions(distribution)
        count = 0

        for snapshot in snapshots:
            snapshot_dir = self.get_version_dir(distribution, snapshot)
            if snapshot_dir.exists():
                shutil.rmtree(snapshot_dir)
                count += 1

        return count

    def version_exists(self, distribution: DistributionName, version: Version) -> bool:
        """
        Check if a specific version exists for a distribution.

        Args:
            distribution: Distribution name
            version: Version to check

        Returns:
            True if version directory exists
        """
        version_dir = self.get_version_dir(distribution, version)
        return version_dir.exists()

    def delete_version(self, distribution: DistributionName, version: Version) -> bool:
        """
        Delete a specific version directory for a distribution.

        Args:
            distribution: Distribution name
            version: Version to delete

        Returns:
            True if version was deleted, False if it didn't exist
        """
        version_dir = self.get_version_dir(distribution, version)
        if version_dir.exists():
            shutil.rmtree(version_dir)
            return True
        return False

    def load_deprecations(self) -> dict[str, dict[str, list[dict[str, Any]]]]:
        """
        Load consolidated deprecations index.

        Returns:
            Dictionary with structure: {distribution: {component_type: [deprecated_components]}}
            Returns empty structure if file doesn't exist
        """
        deprecations_file = self.inventory_dir / "deprecations.yaml"

        if not deprecations_file.exists():
            logger.debug("Deprecations file does not exist, returning empty structure")
            return {
                "core": {component_type: [] for component_type in COMPONENT_TYPES},
                "contrib": {component_type: [] for component_type in COMPONENT_TYPES},
            }

        with open(deprecations_file, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        for dist in ["core", "contrib"]:
            if dist not in data:
                data[dist] = {}
            for component_type in COMPONENT_TYPES:
                if component_type not in data[dist]:
                    data[dist][component_type] = []

        return data

    def save_deprecations(self, deprecations: dict[str, dict[str, list[dict[str, Any]]]]) -> None:
        """
        Save consolidated deprecations index.

        Args:
            deprecations: Dictionary with structure: {distribution: {component_type: [deprecated_components]}}
        """
        deprecations_file = self.inventory_dir / "deprecations.yaml"
        self.inventory_dir.mkdir(parents=True, exist_ok=True)

        with open(deprecations_file, "w", encoding="utf-8") as f:
            yaml.dump(deprecations, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        logger.info(f"Saved deprecations index to {deprecations_file}")

    @staticmethod
    def add_deprecated_components(
        deprecations: dict[str, dict[str, list[dict[str, Any]]]],
        distribution: DistributionName,
        new_deprecated: dict[str, list[dict[str, Any]]],
    ) -> None:
        """
        Add newly deprecated components to the index, avoiding duplicates.

        Args:
            deprecations: Existing deprecations index
            distribution: Distribution name (core or contrib)
            new_deprecated: New deprecated components by type
        """
        for component_type, components in new_deprecated.items():
            existing_names = {comp["name"] for comp in deprecations[distribution][component_type]}

            for component in components:
                if component["name"] not in existing_names:
                    deprecations[distribution][component_type].append(component)
                    logger.info(
                        f"Added deprecated {component_type}: {component['name']} "
                        f"(removed in {component['deprecated_in_version']})"
                    )
                else:
                    logger.debug(f"Skipping duplicate deprecated {component_type}: {component['name']}")
