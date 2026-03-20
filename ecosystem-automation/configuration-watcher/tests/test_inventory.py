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

import pytest
from configuration_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def manager(tmp_path):
    return InventoryManager(str(tmp_path / "registry"))


@pytest.fixture
def sample_schemas(tmp_path):
    """Create a temporary directory with sample schema files."""
    schema_dir = tmp_path / "schemas"
    schema_dir.mkdir()
    (schema_dir / "common.yaml").write_text("common: true")
    (schema_dir / "tracer_provider.yaml").write_text("tracer: true")
    return schema_dir


def _save_sample(manager, version, tmp_path):
    """Helper to save a sample version."""
    source = tmp_path / f"src-{version}"
    source.mkdir(exist_ok=True)
    (source / "common.yaml").write_text("data: true")
    manager.save_versioned_schemas(version, source)


class TestInventoryManager:
    def test_save_versioned_schemas(self, manager, sample_schemas):
        version = Version("1.0.0")
        manager.save_versioned_schemas(version, sample_schemas)

        version_dir = manager.get_version_dir(version)
        assert version_dir.exists()
        assert (version_dir / "common.yaml").exists()
        assert (version_dir / "tracer_provider.yaml").exists()
        assert (version_dir / "common.yaml").read_text() == "common: true"

    def test_list_versions(self, manager, tmp_path):
        for v in ["0.3.0", "0.4.0", "1.0.0"]:
            _save_sample(manager, Version(v), tmp_path)

        versions = manager.list_versions()

        assert len(versions) == 3
        assert str(versions[0]) == "1.0.0"
        assert str(versions[1]) == "0.4.0"
        assert str(versions[2]) == "0.3.0"

    def test_list_versions_empty(self, manager):
        assert manager.list_versions() == []

    def test_list_snapshot_versions(self, manager, tmp_path):
        _save_sample(manager, Version("1.0.0"), tmp_path)
        _save_sample(manager, Version(major=1, minor=0, patch=1, prerelease=("SNAPSHOT",)), tmp_path)
        _save_sample(manager, Version(major=1, minor=1, patch=0, prerelease=("SNAPSHOT",)), tmp_path)

        snapshots = manager.list_snapshot_versions()

        assert len(snapshots) == 2
        assert all(v.prerelease for v in snapshots)

    def test_cleanup_snapshots(self, manager, tmp_path):
        release = Version("1.0.0")
        snap1 = Version(major=1, minor=0, patch=1, prerelease=("SNAPSHOT",))
        snap2 = Version(major=1, minor=1, patch=0, prerelease=("SNAPSHOT",))

        for v in [release, snap1, snap2]:
            _save_sample(manager, v, tmp_path)

        removed = manager.cleanup_snapshots()

        assert removed == 2
        assert manager.version_exists(release)
        assert not manager.version_exists(snap1)
        assert not manager.version_exists(snap2)

    def test_version_exists(self, manager, tmp_path):
        version = Version("1.0.0")
        assert not manager.version_exists(version)

        _save_sample(manager, version, tmp_path)
        assert manager.version_exists(version)

    def test_delete_version(self, manager, tmp_path):
        version = Version("1.0.0")
        _save_sample(manager, version, tmp_path)

        assert manager.delete_version(version)
        assert not manager.version_exists(version)

    def test_delete_version_nonexistent(self, manager):
        assert not manager.delete_version(Version("9.9.9"))
