"""Inventory management for Java instrumentation tracking."""

import shutil
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version


class InventoryManager:
    """Manages Java instrumentation inventory storage and retrieval."""

    FILE_NAME = "instrumentation.yaml"

    def __init__(self, inventory_dir: str = "ecosystem-registry/java/javaagent"):
        """
        Args:
            inventory_dir: Base directory for versioned metadata
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

    def save_versioned_inventory(self, version: Version, instrumentations: dict[str, Any]) -> None:
        """
        Save inventory for a specific version.

        Args:
            version: Version object
            instrumentations: Instrumentation data dict
        """
        version_dir = self.get_version_dir(version)
        version_dir.mkdir(parents=True, exist_ok=True)

        file_path = version_dir / self.FILE_NAME

        inventory_data = {
            **instrumentations,
        }

        with open(file_path, "w") as f:
            yaml.dump(inventory_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    def load_versioned_inventory(self, version: Version) -> dict[str, Any]:
        """
        Load inventory for a specific version.

        Args:
            version: Version object

        Returns:
            Inventory dictionary with full structure, or empty structure if it doesn't exist
        """
        version_dir = self.get_version_dir(version)
        file_path = version_dir / self.FILE_NAME

        if not file_path.exists():
            return {
                "file_format": 0.1,
                "libraries": [],
            }

        with open(file_path) as f:
            data = yaml.safe_load(f) or {}
            return data

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
                    # Parse version string, stripping 'v' prefix
                    # Handles "v2.10.0", "v2.11.0-SNAPSHOT"
                    version = Version(item.name.lstrip("v"))
                    versions.append(version)
                except ValueError:
                    # Skip directories that don't match version format
                    continue

        return sorted(versions, reverse=True)

    def list_snapshot_versions(self) -> list[Version]:
        """
        List all snapshot versions.

        Returns:
            List of snapshot versions
        """
        all_versions = self.list_versions()
        return [v for v in all_versions if v.prerelease]

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
        version_dir = self.get_version_dir(version)
        return version_dir.exists() and (version_dir / self.FILE_NAME).exists()
