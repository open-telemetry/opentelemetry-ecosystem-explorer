"""Tests for collector sync."""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import git
import pytest
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
