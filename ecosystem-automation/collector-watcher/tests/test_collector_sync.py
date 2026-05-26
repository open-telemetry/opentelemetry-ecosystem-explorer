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
"""Tests for collector sync."""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import git
import pytest
import yaml
from collector_watcher.collector_sync import CollectorSync
from collector_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def temp_inventory_dir():
    """Create a temporary inventory directory."""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


@pytest.fixture
def temp_git_repos(tmp_path):
    repos = {}

    for dist in ["core", "contrib"]:
        repo_path = tmp_path / dist
        repo_path.mkdir()

        repo = git.Repo.init(repo_path)

        test_file = repo_path / "test.txt"
        test_file.write_text("initial content")
        repo.index.add(["test.txt"])
        repo.index.commit("Initial commit")

        try:
            repo.git.checkout("-b", "main")
        except git.exc.GitCommandError:
            repo.git.checkout("main")

        repo.create_tag("v0.110.0")

        test_file.write_text("update 1")
        repo.index.add(["test.txt"])
        repo.index.commit("Update 1")
        repo.create_tag("v0.111.0")

        test_file.write_text("update 2")
        repo.index.add(["test.txt"])
        repo.index.commit("Update 2")
        repo.create_tag("v0.112.0")

        repos[dist] = str(repo_path)

    return repos


@pytest.fixture
def sample_components():
    return {
        "connector": [],
        "exporter": [
            {"name": "loggingexporter", "has_metadata": True},
        ],
        "extension": [],
        "processor": [
            {"name": "batchprocessor", "has_metadata": True},
        ],
        "receiver": [
            {"name": "otlpreceiver", "has_metadata": True},
        ],
    }


@pytest.fixture
def collector_sync(temp_git_repos, temp_inventory_dir):
    inventory_manager = InventoryManager(str(temp_inventory_dir))
    return CollectorSync(
        repos=temp_git_repos,
        inventory_manager=inventory_manager,
    )


def test_get_repository_name(collector_sync):
    assert collector_sync.get_repository_name("core") == "opentelemetry-collector"
    assert collector_sync.get_repository_name("contrib") == "opentelemetry-collector-contrib"


def test_scan_version_without_checkout(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        version = Version("0.112.0")
        result = collector_sync.scan_version("core", version, checkout=False)

        assert result == sample_components
        mock_scanner.assert_called_once()


def test_save_version(collector_sync, sample_components, temp_inventory_dir):
    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    version_dir = temp_inventory_dir / "core" / "v0.112.0"
    assert version_dir.exists()
    assert (version_dir / "receiver.yaml").exists()
    assert (version_dir / "processor.yaml").exists()
    assert (version_dir / "exporter.yaml").exists()


def test_save_version_writes_schema_hash_unknown_when_schema_absent(
    collector_sync, sample_components, temp_inventory_dir
):
    """When the upstream repo has no metadata-schema.yaml, schema_hash is 'unknown'."""
    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    version_dir = temp_inventory_dir / "core" / "v0.112.0"
    with open(version_dir / "receiver.yaml") as f:
        data = yaml.safe_load(f)
    assert data["schema_hash"] == "unknown"


def test_save_version_writes_schema_hash_when_schema_present(
    collector_sync, sample_components, temp_inventory_dir, temp_git_repos
):
    """When the upstream repo has metadata-schema.yaml, schema_hash is a 12-char hex."""
    # Plant a fake schema file in the repo the sync uses for "core"
    schema_dir = Path(temp_git_repos["core"]) / "cmd" / "mdatagen"
    schema_dir.mkdir(parents=True, exist_ok=True)
    (schema_dir / "metadata-schema.yaml").write_text("type: object\n")

    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    version_dir = temp_inventory_dir / "core" / "v0.112.0"
    with open(version_dir / "receiver.yaml") as f:
        data = yaml.safe_load(f)

    schema_hash = data["schema_hash"]
    assert schema_hash != "unknown"
    assert len(schema_hash) == 12
    assert all(c in "0123456789abcdef" for c in schema_hash)


def test_save_version_contrib_reads_schema_hash_from_core(
    collector_sync, sample_components, temp_inventory_dir, temp_git_repos
):
    """Contrib has no mdatagen — its schema_hash must come from the core repo."""
    # Plant a schema file in core only. Contrib intentionally has none.
    schema_dir = Path(temp_git_repos["core"]) / "cmd" / "mdatagen"
    schema_dir.mkdir(parents=True, exist_ok=True)
    (schema_dir / "metadata-schema.yaml").write_text("type: object\n")

    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)
    collector_sync.save_version("contrib", version, sample_components)

    with open(temp_inventory_dir / "core" / "v0.112.0" / "receiver.yaml") as f:
        core_hash = yaml.safe_load(f)["schema_hash"]
    with open(temp_inventory_dir / "contrib" / "v0.112.0" / "receiver.yaml") as f:
        contrib_hash = yaml.safe_load(f)["schema_hash"]

    assert contrib_hash != "unknown"
    assert contrib_hash == core_hash


def test_save_version_stores_schema_in_cas_when_present(
    collector_sync, sample_components, temp_inventory_dir, temp_git_repos
):
    """The schema is stored at meta/schemas/{hash}.yaml, not under a distribution directory."""
    schema_dir = Path(temp_git_repos["core"]) / "cmd" / "mdatagen"
    schema_dir.mkdir(parents=True, exist_ok=True)
    (schema_dir / "metadata-schema.yaml").write_text("type: object\n")

    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    with open(temp_inventory_dir / "core" / "v0.112.0" / "receiver.yaml") as f:
        schema_hash = yaml.safe_load(f)["schema_hash"]

    schemas_dir = temp_inventory_dir / "meta" / "schemas"
    stored = schemas_dir / f"{schema_hash}.yaml"
    assert stored.exists()
    assert stored.read_text() == "type: object\n"

    # Schema is NOT duplicated inside the distribution directory
    assert not (temp_inventory_dir / "core" / "v0.112.0" / "metadata-schema.yaml").exists()


def test_save_version_cas_dedupes_across_distributions(
    collector_sync, sample_components, temp_inventory_dir, temp_git_repos
):
    """Saving core and contrib at the same schema content yields a single CAS file."""
    schema_dir = Path(temp_git_repos["core"]) / "cmd" / "mdatagen"
    schema_dir.mkdir(parents=True, exist_ok=True)
    (schema_dir / "metadata-schema.yaml").write_text("type: object\n")

    version = Version("0.112.0")
    collector_sync.save_version("contrib", version, sample_components)
    collector_sync.save_version("core", version, sample_components)

    schemas_dir = temp_inventory_dir / "meta" / "schemas"
    stored_files = list(schemas_dir.glob("*.yaml"))
    assert len(stored_files) == 1


def test_save_version_does_not_create_schema_file_when_absent(collector_sync, sample_components, temp_inventory_dir):
    """When core has no schema, nothing is written to meta/schemas/ and schema_hash is 'unknown'."""
    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    schemas_dir = temp_inventory_dir / "meta" / "schemas"
    assert not schemas_dir.exists() or not any(schemas_dir.iterdir())
    assert not (temp_inventory_dir / "core" / "v0.112.0" / "metadata-schema.yaml").exists()


def test_process_latest_release_already_exists(collector_sync, sample_components, temp_inventory_dir):
    version = Version("0.112.0")
    collector_sync.save_version("core", version, sample_components)

    result = collector_sync.process_latest_release("core")

    # Should return None since it already exists
    assert result is None


def test_process_latest_release_new_version(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        result = collector_sync.process_latest_release("core")

        # Should return the version that was processed
        assert result is not None
        assert str(result) == "0.112.0"


def test_update_snapshot_version(collector_sync, sample_components, temp_inventory_dir):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        # Create an old snapshot
        old_snapshot = Version(major=0, minor=111, patch=0, prerelease=("SNAPSHOT",))
        collector_sync.save_version("core", old_snapshot, sample_components)
        assert collector_sync.inventory_manager.version_exists("core", old_snapshot)

        # Update snapshot
        result = collector_sync.update_snapshot("core")

        # Old snapshot should be removed
        assert not collector_sync.inventory_manager.version_exists("core", old_snapshot)

        # New snapshot should exist
        assert result.prerelease
        assert collector_sync.inventory_manager.version_exists("core", result)


def test_cleanup_multiple_snapshots(collector_sync, sample_components):
    snapshots = [
        Version(major=0, minor=110, patch=0, prerelease=("SNAPSHOT",)),
        Version(major=0, minor=111, patch=0, prerelease=("SNAPSHOT",)),
        Version(major=0, minor=112, patch=0, prerelease=("SNAPSHOT",)),
    ]

    for snapshot in snapshots:
        collector_sync.save_version("core", snapshot, sample_components)

    for snapshot in snapshots:
        assert collector_sync.inventory_manager.version_exists("core", snapshot)

    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        collector_sync.update_snapshot("core")

    for snapshot in snapshots:
        assert not collector_sync.inventory_manager.version_exists("core", snapshot)


def test_complete_sync_workflow(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        result = collector_sync.sync()

        assert len(result["new_releases"]) == 2
        assert len(result["snapshots_updated"]) == 2

        release_dists = [item["distribution"] for item in result["new_releases"]]
        assert "core" in release_dists
        assert "contrib" in release_dists

        snapshot_dists = [item["distribution"] for item in result["snapshots_updated"]]
        assert "core" in snapshot_dists
        assert "contrib" in snapshot_dists


def test_sync_no_new_releases(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        collector_sync.sync()

        # Run again - should not process releases again
        result = collector_sync.sync()

        # No new releases
        assert len(result["new_releases"]) == 0
        # But snapshots should still be updated
        assert len(result["snapshots_updated"]) == 2


def test_scan_version_snapshot_checkout(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        snapshot_version = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))

        with patch.object(collector_sync.version_detectors["core"], "checkout_main") as mock_checkout:
            collector_sync.scan_version("core", snapshot_version, checkout=True)

            mock_checkout.assert_called_once()


def test_scan_version_release_checkout(collector_sync, sample_components):
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        release_version = Version("0.112.0")

        with patch.object(collector_sync.version_detectors["core"], "checkout_version") as mock_checkout:
            collector_sync.scan_version("core", release_version, checkout=True)

            mock_checkout.assert_called_once_with(release_version)


def test_deprecations_not_tracked_for_snapshots(collector_sync):
    previous_components = {
        "receiver": [
            {"name": "receiver1", "source_repo": "core", "distributions": ["core"], "subtype": None},
            {"name": "receiver2", "source_repo": "core", "distributions": ["core"], "subtype": None},
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    current_components = {
        "receiver": [
            {"name": "receiver1", "source_repo": "core", "distributions": ["core"], "subtype": None},
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    release_version = Version("0.112.0")
    snapshot_version = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))

    collector_sync.previous_versions["core"] = release_version
    collector_sync.previous_components["core"] = previous_components

    collector_sync.detect_and_track_deprecations("core", snapshot_version, current_components)

    assert len(collector_sync.deprecations["core"]["receiver"]) == 0

    collector_sync.previous_versions["core"] = release_version
    collector_sync.previous_components["core"] = previous_components

    next_release_version = Version("0.113.0")
    collector_sync.detect_and_track_deprecations("core", next_release_version, current_components)

    assert len(collector_sync.deprecations["core"]["receiver"]) == 1
    assert collector_sync.deprecations["core"]["receiver"][0]["name"] == "receiver2"


def test_initialize_previous_version_filters_snapshots(collector_sync, sample_components):
    release_version = Version("0.112.0")
    collector_sync.save_version("core", release_version, sample_components)

    # Save a snapshot version (newer than the release)
    snapshot_version = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    collector_sync.save_version("core", snapshot_version, sample_components)

    # Initialize previous version should use the release, not the snapshot
    collector_sync.initialize_previous_version("core")

    assert collector_sync.previous_versions["core"] == release_version
    assert collector_sync.previous_versions["core"] != snapshot_version
    assert not collector_sync.previous_versions["core"].prerelease


def test_baseline_not_updated_for_prereleases(collector_sync):
    v1_components = {
        "receiver": [
            {"name": "receiver1", "source_repo": "core", "distributions": ["core"], "subtype": None},
            {"name": "receiver2", "source_repo": "core", "distributions": ["core"], "subtype": None},
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    v2_components = {
        "receiver": [
            {"name": "receiver1", "source_repo": "core", "distributions": ["core"], "subtype": None},
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    v1 = Version("0.112.0")
    snapshot = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    v2 = Version("0.113.0")

    # Process first release
    collector_sync.detect_and_track_deprecations("core", v1, v1_components)
    assert collector_sync.previous_versions["core"] == v1
    baseline_after_v1 = collector_sync.previous_versions["core"]

    # Process snapshot - baseline should NOT update
    collector_sync.detect_and_track_deprecations("core", snapshot, v2_components)
    assert collector_sync.previous_versions["core"] == baseline_after_v1
    assert collector_sync.previous_versions["core"] == v1
    assert collector_sync.previous_versions["core"] != snapshot

    # Process next release - should compare against v1, not snapshot
    collector_sync.detect_and_track_deprecations("core", v2, v2_components)
    assert collector_sync.previous_versions["core"] == v2

    # Verify deprecation was detected between v1 and v2 (not snapshot)
    assert len(collector_sync.deprecations["core"]["receiver"]) == 1
    assert collector_sync.deprecations["core"]["receiver"][0]["name"] == "receiver2"
    assert collector_sync.deprecations["core"]["receiver"][0]["last_version"] == f"v{v1}"
    assert collector_sync.deprecations["core"]["receiver"][0]["deprecated_in_version"] == f"v{v2}"
