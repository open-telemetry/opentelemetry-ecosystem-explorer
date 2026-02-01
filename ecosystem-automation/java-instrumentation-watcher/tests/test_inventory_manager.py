"""Tests for inventory manager."""

import tempfile
from pathlib import Path

import pytest
import yaml
from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


class TestInventoryManager:
    @pytest.fixture
    def temp_inventory_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def inventory_manager(self, temp_inventory_dir):
        return InventoryManager(inventory_dir=temp_inventory_dir)

    def test_get_version_dir(self, inventory_manager, temp_inventory_dir):
        version = Version("2.10.0")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v2.10.0"
        assert version_dir == expected

    def test_get_version_dir_snapshot(self, inventory_manager, temp_inventory_dir):
        version = Version("2.11.0-SNAPSHOT")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v2.11.0-SNAPSHOT"
        assert version_dir == expected

    def test_save_versioned_inventory(self, inventory_manager):
        version = Version("2.10.0")
        instrumentations = [
            {"id": "akka-actor", "name": "Akka Actor", "stability": "stable"},
            {"id": "apache-camel", "name": "Apache Camel", "stability": "stable"},
        ]

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
            repository="opentelemetry-java-instrumentation",
        )

        version_dir = inventory_manager.get_version_dir(version)
        file_path = version_dir / "instrumentation.yaml"
        assert file_path.exists()

        with open(file_path) as f:
            data = yaml.safe_load(f)
            assert data["version"] == "2.10.0"
            assert data["repository"] == "opentelemetry-java-instrumentation"
            assert len(data["instrumentations"]) == 2
            assert data["instrumentations"][0]["id"] == "akka-actor"

    def test_load_versioned_inventory(self, inventory_manager):
        version = Version("2.10.0")
        instrumentations = [
            {"id": "akka-actor", "name": "Akka Actor"},
        ]

        # Save first
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        # Load
        loaded = inventory_manager.load_versioned_inventory(version)

        assert loaded["version"] == "2.10.0"
        assert loaded["repository"] == "opentelemetry-java-instrumentation"
        assert len(loaded["instrumentations"]) == 1
        assert loaded["instrumentations"][0]["id"] == "akka-actor"

    def test_load_nonexistent_inventory(self, inventory_manager):
        version = Version("2.10.0")
        loaded = inventory_manager.load_versioned_inventory(version)

        assert loaded["version"] == "2.10.0"
        assert loaded["repository"] == "opentelemetry-java-instrumentation"
        assert loaded["instrumentations"] == []

    def test_list_versions(self, inventory_manager):
        versions = [
            Version("2.9.0"),
            Version("2.10.0"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations=[],
            )

        listed_versions = inventory_manager.list_versions()

        # Should be sorted newest to oldest
        assert len(listed_versions) == 3
        assert listed_versions[0] == Version("2.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("2.10.0")
        assert listed_versions[2] == Version("2.9.0")

    def test_list_versions_empty(self, inventory_manager):
        versions = inventory_manager.list_versions()
        assert versions == []

    def test_list_snapshot_versions(self, inventory_manager):
        versions = [
            Version("2.9.0"),  # Release
            Version("2.10.0-SNAPSHOT"),  # Snapshot
            Version("2.11.0-SNAPSHOT"),  # Snapshot
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations=[],
            )

        snapshots = inventory_manager.list_snapshot_versions()

        assert len(snapshots) == 2
        assert all(v.prerelease for v in snapshots)
        assert Version("2.9.0") not in snapshots

    def test_cleanup_snapshots(self, inventory_manager):
        versions = [
            Version("2.9.0"),
            Version("2.10.0-SNAPSHOT"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations=[],
            )

        removed_count = inventory_manager.cleanup_snapshots()

        assert removed_count == 2

        # Verify only release remains
        remaining_versions = inventory_manager.list_versions()
        assert len(remaining_versions) == 1
        assert remaining_versions[0] == Version("2.9.0")

    def test_version_exists(self, inventory_manager):
        version = Version("2.10.0")

        assert not inventory_manager.version_exists(version)

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=[],
        )

        assert inventory_manager.version_exists(version)

    def test_version_exists_directory_only(self, inventory_manager):
        version = Version("2.10.0")
        version_dir = inventory_manager.get_version_dir(version)
        version_dir.mkdir(parents=True)

        # Directory exists but no instrumentation.yaml file
        assert not inventory_manager.version_exists(version)

    def test_save_with_snapshot_version(self, inventory_manager):
        version = Version("2.11.0-SNAPSHOT")
        instrumentations = [{"id": "test"}]

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        version_dir = inventory_manager.get_version_dir(version)
        assert version_dir.name == "v2.11.0-SNAPSHOT"

        loaded = inventory_manager.load_versioned_inventory(version)
        assert loaded["version"] == "2.11.0-SNAPSHOT"

    def test_version_comparison_in_list(self, inventory_manager):
        versions = [
            Version("1.0.0"),
            Version("2.10.0"),
            Version("2.9.0"),
            Version("2.10.1"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations=[],
            )

        listed_versions = inventory_manager.list_versions()

        # Verify proper semantic version sorting (newest first)
        assert listed_versions[0] == Version("2.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("2.10.1")
        assert listed_versions[2] == Version("2.10.0")
        assert listed_versions[3] == Version("2.9.0")
        assert listed_versions[4] == Version("1.0.0")

    def test_list_versions_skips_invalid_dirs(self, inventory_manager):
        valid_version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=valid_version,
            instrumentations=[],
        )

        # Create an invalid directory
        invalid_dir = inventory_manager.inventory_dir / "not-a-version"
        invalid_dir.mkdir(parents=True)

        # List should only include valid version
        versions = inventory_manager.list_versions()
        assert len(versions) == 1
        assert versions[0] == valid_version

    def test_save_and_load_complex_instrumentations(self, inventory_manager):
        version = Version("2.10.0")
        instrumentations = [
            {
                "id": "akka-actor",
                "name": "Akka Actor",
                "stability": "stable",
                "support": {"class": "community"},
                "categories": ["library"],
            },
            {
                "id": "apache-camel",
                "name": "Apache Camel",
                "stability": "experimental",
                "support": {"class": "community"},
                "categories": ["library", "integration"],
            },
        ]

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        loaded = inventory_manager.load_versioned_inventory(version)

        assert len(loaded["instrumentations"]) == 2
        assert loaded["instrumentations"][0]["support"]["class"] == "community"
        assert loaded["instrumentations"][1]["categories"] == ["library", "integration"]
