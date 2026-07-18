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
"""Tests for inventory manager."""

import tempfile
from pathlib import Path

import pytest
import yaml
from dotnet_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def temp_inventory_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def inventory_manager(temp_inventory_dir):
    return InventoryManager(inventory_dir=temp_inventory_dir)


class TestInventoryManager:
    def test_get_version_dir(self, inventory_manager, temp_inventory_dir):
        version = Version("1.10.0")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v1.10.0"
        assert version_dir == expected

    def test_get_version_dir_snapshot(self, inventory_manager, temp_inventory_dir):
        version = Version("1.11.0-SNAPSHOT")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v1.11.0-SNAPSHOT"
        assert version_dir == expected

    def test_save_versioned_inventory(self, inventory_manager):
        version = Version("1.10.0")
        modules = {
            "modules": [
                {"name": "OpenTelemetry.Instrumentation.Http", "type": "instrumentation", "version": "1.10.0"},
                {"name": "OpenTelemetry.Exporter.Console", "type": "exporter", "version": "1.10.0"},
            ]
        }

        inventory_manager.save_versioned_inventory(version=version, instrumentations=modules)

        version_dir = inventory_manager.get_version_dir(version)
        file_path = version_dir / "instrumentation.yaml"
        assert file_path.exists()

        with open(file_path) as f:
            data = yaml.safe_load(f)
            assert isinstance(data["modules"], list)
            assert len(data["modules"]) == 2
            assert data["modules"][0]["name"] == "OpenTelemetry.Instrumentation.Http"

    def test_load_versioned_inventory(self, inventory_manager):
        version = Version("1.10.0")
        modules = {
            "modules": [
                {"name": "OpenTelemetry.Instrumentation.Http", "type": "instrumentation", "version": "1.10.0"},
            ]
        }

        inventory_manager.save_versioned_inventory(version=version, instrumentations=modules)

        loaded = inventory_manager.load_versioned_inventory(version)

        assert isinstance(loaded["modules"], list)
        assert loaded["modules"][0]["name"] == "OpenTelemetry.Instrumentation.Http"

    def test_load_nonexistent_inventory(self, inventory_manager):
        version = Version("1.10.0")
        loaded = inventory_manager.load_versioned_inventory(version)

        assert loaded == {"modules": []}

    def test_version_exists(self, inventory_manager):
        version = Version("1.10.0")

        assert not inventory_manager.version_exists(version)

        inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        assert inventory_manager.version_exists(version)

    def test_save_with_snapshot_version(self, inventory_manager):
        version = Version("1.11.0-SNAPSHOT")
        inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        version_dir = inventory_manager.get_version_dir(version)
        assert version_dir.name == "v1.11.0-SNAPSHOT"

    def test_list_versions(self, inventory_manager):
        versions = [
            Version("1.9.0"),
            Version("1.10.0"),
            Version("1.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        listed_versions = inventory_manager.list_versions()

        assert len(listed_versions) == 3
        assert listed_versions[0] == Version("1.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("1.10.0")
        assert listed_versions[2] == Version("1.9.0")

    def test_list_versions_empty(self, inventory_manager):
        versions = inventory_manager.list_versions()
        assert versions == []

    def test_list_snapshot_versions(self, inventory_manager):
        versions = [
            Version("1.9.0"),
            Version("1.10.0-SNAPSHOT"),
            Version("1.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        snapshots = inventory_manager.list_snapshot_versions()

        assert len(snapshots) == 2
        assert all(v.prerelease for v in snapshots)
        assert Version("1.9.0") not in snapshots

    def test_cleanup_snapshots(self, inventory_manager):
        versions = [
            Version("1.9.0"),
            Version("1.10.0-SNAPSHOT"),
            Version("1.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        removed_count = inventory_manager.cleanup_snapshots()

        assert removed_count == 2

        remaining_versions = inventory_manager.list_versions()
        assert len(remaining_versions) == 1
        assert remaining_versions[0] == Version("1.9.0")

    def test_version_comparison_in_list(self, inventory_manager):
        versions = [
            Version("1.0.0"),
            Version("1.10.0"),
            Version("1.9.0"),
            Version("1.10.1"),
            Version("1.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(version=version, instrumentations={"modules": []})

        listed_versions = inventory_manager.list_versions()

        assert listed_versions[0] == Version("1.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("1.10.1")
        assert listed_versions[2] == Version("1.10.0")
        assert listed_versions[3] == Version("1.9.0")
        assert listed_versions[4] == Version("1.0.0")

    def test_list_versions_skips_invalid_dirs(self, inventory_manager):
        valid_version = Version("1.10.0")
        inventory_manager.save_versioned_inventory(version=valid_version, instrumentations={"modules": []})

        invalid_dir = inventory_manager.inventory_dir / "not-a-version"
        invalid_dir.mkdir(parents=True)

        versions = inventory_manager.list_versions()
        assert len(versions) == 1
        assert versions[0] == valid_version
