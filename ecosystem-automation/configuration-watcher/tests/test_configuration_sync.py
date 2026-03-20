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
"""Tests for configuration sync."""

import git
import pytest
from configuration_watcher.configuration_sync import ConfigurationSync
from configuration_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def temp_git_repo(tmp_path):
    """Create a temporary git repo with schema files and version tags."""
    repo_path = tmp_path / "config_repo"
    repo_path.mkdir()

    schema_dir = repo_path / "schema"
    schema_dir.mkdir()
    (schema_dir / "common.yaml").write_text("common: true")
    (schema_dir / "tracer_provider.yaml").write_text("tracer: true")

    repo = git.Repo.init(repo_path)
    repo.index.add(["schema/common.yaml", "schema/tracer_provider.yaml"])
    repo.index.commit("Initial commit")

    try:
        repo.git.checkout("-b", "main")
    except git.exc.GitCommandError:
        repo.git.checkout("main")

    repo.create_tag("v0.3.0")

    (schema_dir / "meter_provider.yaml").write_text("meter: true")
    repo.index.add(["schema/meter_provider.yaml"])
    repo.index.commit("Add meter provider")
    repo.create_tag("v0.4.0")

    (schema_dir / "logger_provider.yaml").write_text("logger: true")
    repo.index.add(["schema/logger_provider.yaml"])
    repo.index.commit("Add logger provider")
    repo.create_tag("v1.0.0")

    return repo_path


@pytest.fixture
def temp_inventory_dir(tmp_path):
    return tmp_path / "inventory"


@pytest.fixture
def config_sync(temp_git_repo, temp_inventory_dir):
    inventory_manager = InventoryManager(str(temp_inventory_dir))
    return ConfigurationSync(
        repo_path=str(temp_git_repo),
        inventory_manager=inventory_manager,
    )


class TestConfigurationSync:
    def test_process_latest_release_new_version(self, config_sync):
        result = config_sync.process_latest_release()

        assert result is not None
        assert str(result) == "1.0.0"
        assert config_sync.inventory_manager.version_exists(result)

    def test_process_latest_release_already_exists(self, config_sync):
        config_sync.process_latest_release()

        result = config_sync.process_latest_release()

        assert result is None

    def test_process_latest_release_copies_correct_files(self, config_sync):
        result = config_sync.process_latest_release()

        version_dir = config_sync.inventory_manager.get_version_dir(result)
        assert (version_dir / "common.yaml").exists()
        assert (version_dir / "tracer_provider.yaml").exists()
        assert (version_dir / "meter_provider.yaml").exists()
        assert (version_dir / "logger_provider.yaml").exists()

    def test_update_snapshot(self, config_sync):
        result = config_sync.update_snapshot()

        assert result.prerelease
        assert config_sync.inventory_manager.version_exists(result)

    def test_update_snapshot_cleans_old_snapshots(self, config_sync, temp_inventory_dir):
        # Manually create an old snapshot that differs from the current one
        old_snapshot = Version(major=0, minor=99, patch=0, prerelease=("SNAPSHOT",))
        old_dir = temp_inventory_dir / f"v{old_snapshot}"
        old_dir.mkdir(parents=True)
        (old_dir / "old.yaml").write_text("old: true")
        assert config_sync.inventory_manager.version_exists(old_snapshot)

        # Update snapshot should clean the old one
        new_snapshot = config_sync.update_snapshot()

        assert not config_sync.inventory_manager.version_exists(old_snapshot)
        assert config_sync.inventory_manager.version_exists(new_snapshot)

    def test_complete_sync_workflow(self, config_sync):
        result = config_sync.sync()

        assert result["new_release"] == "1.0.0"
        assert result["snapshot_updated"] is not None

    def test_backfill_specific_version(self, config_sync):
        # First sync to populate
        config_sync.sync()

        # Backfill v1.0.0
        result = config_sync.backfill([Version("1.0.0")])

        assert "1.0.0" in result["versions_processed"]
        assert config_sync.inventory_manager.version_exists(Version("1.0.0"))

    def test_backfill_all_versions(self, config_sync):
        config_sync.sync()

        result = config_sync.backfill()

        assert len(result["versions_processed"]) >= 1
