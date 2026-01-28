"""Tests for collector sync."""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import git
import pytest
from collector_watcher.collector_sync import CollectorSync
from collector_watcher.inventory_manager import InventoryManager
from collector_watcher.version import Version


@pytest.fixture
def temp_inventory_dir():
    """Create a temporary inventory directory."""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


@pytest.fixture
def temp_git_repos(tmp_path):
    """Create temporary git repositories for core and contrib."""
    repos = {}

    for dist in ["core", "contrib"]:
        repo_path = tmp_path / dist
        repo_path.mkdir()

        repo = git.Repo.init(repo_path)

        # Create initial commit
        test_file = repo_path / "test.txt"
        test_file.write_text("initial content")
        repo.index.add(["test.txt"])
        repo.index.commit("Initial commit")

        # Explicitly create and checkout main branch
        try:
            repo.git.checkout("-b", "main")
        except git.exc.GitCommandError:
            repo.git.checkout("main")

        # Create some version tags
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
    """Sample component data for testing."""
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
    """Create a CollectorSync instance for testing."""
    inventory_manager = InventoryManager(str(temp_inventory_dir))
    return CollectorSync(
        repos=temp_git_repos,
        inventory_manager=inventory_manager,
    )


def test_get_repository_name(collector_sync):
    """Test repository name mapping."""
    assert collector_sync.get_repository_name("core") == "opentelemetry-collector"
    assert collector_sync.get_repository_name("contrib") == "opentelemetry-collector-contrib"


def test_scan_version_without_checkout(collector_sync, sample_components):
    """Test scanning a version without checking out."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        version = Version(0, 112, 0)
        result = collector_sync.scan_version("core", version, checkout=False)

        assert result == sample_components
        mock_scanner.assert_called_once()


def test_save_version(collector_sync, sample_components, temp_inventory_dir):
    """Test saving scanned components."""
    version = Version(0, 112, 0)
    collector_sync.save_version("core", version, sample_components)

    # Verify files were created
    version_dir = temp_inventory_dir / "core" / "v0.112.0"
    assert version_dir.exists()
    assert (version_dir / "receiver.yaml").exists()
    assert (version_dir / "processor.yaml").exists()
    assert (version_dir / "exporter.yaml").exists()


def test_process_latest_release_already_exists(collector_sync, sample_components, temp_inventory_dir):
    """Test processing latest release when it already exists."""
    # Pre-save the latest version
    version = Version(0, 112, 0)
    collector_sync.save_version("core", version, sample_components)

    # Try to process it again
    result = collector_sync.process_latest_release("core")

    # Should return None since it already exists
    assert result is None


def test_process_latest_release_new_version(collector_sync, sample_components):
    """Test processing a new latest release."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        result = collector_sync.process_latest_release("core")

        # Should return the version that was processed
        assert result is not None
        assert str(result) == "v0.112.0"


def test_update_snapshot(collector_sync, sample_components, temp_inventory_dir):
    """Test updating snapshot version."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        # Create an old snapshot
        old_snapshot = Version(0, 111, 0, is_snapshot=True)
        collector_sync.save_version("core", old_snapshot, sample_components)
        assert collector_sync.inventory_manager.version_exists("core", old_snapshot)

        # Update snapshot
        result = collector_sync.update_snapshot("core")

        # Old snapshot should be removed
        assert not collector_sync.inventory_manager.version_exists("core", old_snapshot)

        # New snapshot should exist
        assert result.is_snapshot
        assert collector_sync.inventory_manager.version_exists("core", result)


def test_cleanup_multiple_snapshots(collector_sync, sample_components):
    """Test that cleanup removes all old snapshots."""
    # Create multiple snapshots
    snapshots = [
        Version(0, 110, 0, is_snapshot=True),
        Version(0, 111, 0, is_snapshot=True),
        Version(0, 112, 0, is_snapshot=True),
    ]

    for snapshot in snapshots:
        collector_sync.save_version("core", snapshot, sample_components)

    # Verify all exist
    for snapshot in snapshots:
        assert collector_sync.inventory_manager.version_exists("core", snapshot)

    # Update snapshot (which cleans up old ones)
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        collector_sync.update_snapshot("core")

    # All old snapshots should be removed
    for snapshot in snapshots:
        assert not collector_sync.inventory_manager.version_exists("core", snapshot)


def test_sync(collector_sync, sample_components):
    """Test running the complete sync workflow."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        result = collector_sync.sync()

        # Should have processed both distributions
        assert len(result["new_releases"]) == 2
        assert len(result["snapshots_updated"]) == 2

        # Verify distribution names
        release_dists = [item["distribution"] for item in result["new_releases"]]
        assert "core" in release_dists
        assert "contrib" in release_dists

        snapshot_dists = [item["distribution"] for item in result["snapshots_updated"]]
        assert "core" in snapshot_dists
        assert "contrib" in snapshot_dists


def test_sync_no_new_releases(collector_sync, sample_components):
    """Test sync when releases already exist."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        # Run once to save all releases
        collector_sync.sync()

        # Run again - should not process releases again
        result = collector_sync.sync()

        # No new releases
        assert len(result["new_releases"]) == 0
        # But snapshots should still be updated
        assert len(result["snapshots_updated"]) == 2


def test_scan_version_snapshot_checkout(collector_sync, sample_components):
    """Test that snapshot versions checkout main branch."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        snapshot_version = Version(0, 113, 0, is_snapshot=True)

        # Mock the version detector's checkout_main method
        with patch.object(collector_sync.version_detectors["core"], "checkout_main") as mock_checkout:
            collector_sync.scan_version("core", snapshot_version, checkout=True)

            # Should have called checkout_main
            mock_checkout.assert_called_once()


def test_scan_version_release_checkout(collector_sync, sample_components):
    """Test that release versions checkout the specific tag."""
    with patch("collector_watcher.collector_sync.ComponentScanner") as mock_scanner:
        mock_instance = Mock()
        mock_instance.scan_all_components.return_value = sample_components
        mock_scanner.return_value = mock_instance

        release_version = Version(0, 112, 0)

        # Mock the version detector's checkout_version method
        with patch.object(collector_sync.version_detectors["core"], "checkout_version") as mock_checkout:
            collector_sync.scan_version("core", release_version, checkout=True)

            # Should have called checkout_version
            mock_checkout.assert_called_once_with(release_version)
