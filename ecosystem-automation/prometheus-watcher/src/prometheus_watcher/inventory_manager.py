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
"""Inventory management for Prometheus ecosystem data."""

import logging
from typing import Any

import yaml
from semantic_version import Version
from watcher_common.inventory_manager import BaseInventoryManager

logger = logging.getLogger(__name__)


class InventoryManager(BaseInventoryManager):
    """Manages Prometheus ecosystem inventory storage and retrieval."""

    def __init__(self, inventory_dir: str = "ecosystem-registry/prometheus"):
        """
        Args:
            inventory_dir: Base directory for versioned metadata
        """
        super().__init__(inventory_dir)

    def list_release_versions(self, distribution: str) -> list[Version]:
        """List all available release versions for a distribution.

        Args:
            distribution: Distribution name ("official" or "community")

        Returns:
            Sorted list of semantic versions
        """
        dist_dir = self.inventory_dir / distribution
        if not dist_dir.exists():
            return []

        versions = []
        for v_dir in dist_dir.iterdir():
            if v_dir.is_dir():
                try:
                    # Strip 'v' prefix if present
                    version = Version(v_dir.name.lstrip("v"))
                    if not version.prerelease:
                        versions.append(version)
                except ValueError:
                    continue
        return sorted(versions, reverse=True)

    def load_versioned_inventory(self, distribution: str, version: Version) -> dict[str, Any]:
        """
        Load all inventory files for a specific version and distribution.

        Args:
            distribution: Distribution name ("official" or "community")
            version: Version object

        Returns:
            Merged inventory dictionary
        """
        # Directory names have 'v' prefix
        version_dir = self.inventory_dir / distribution / f"v{version}"
        if not version_dir.exists():
            return {}

        merged_data: dict[str, Any] = {"distribution": distribution, "version": str(version), "components": {}}

        for yaml_file in version_dir.glob("*.yaml"):
            with open(yaml_file) as f:
                data = yaml.safe_load(f) or {}
                if "repository" in data:
                    merged_data["repository"] = data["repository"]

                component_type = data.get("component_type")
                if component_type:
                    components = data.get("components", [])
                    merged_data["components"][component_type] = components

        return merged_data
