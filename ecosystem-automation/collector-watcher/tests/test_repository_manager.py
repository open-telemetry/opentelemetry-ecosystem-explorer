"""Tests for repository manager."""

import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from collector_watcher.repository_manager import (
    ENV_VAR_NAMES,
    REPO_URLS,
    RepositoryManager,
)
from collector_watcher.version import Version


@pytest.fixture
def temp_dir():
    temp_path = tempfile.mkdtemp()
    yield Path(temp_path)
    shutil.rmtree(temp_path)


@pytest.fixture
def mock_repo():
    """Create a mock git repository."""
    temp_path = tempfile.mkdtemp()
    repo_path = Path(temp_path)

    subprocess.run(["git", "init"], cwd=repo_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=repo_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test User"],
        cwd=repo_path,
        check=True,
        capture_output=True,
    )

    # Create a commit
    (repo_path / "README.md").write_text("Test repo")
    subprocess.run(["git", "add", "."], cwd=repo_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "Initial commit"],
        cwd=repo_path,
        check=True,
        capture_output=True,
    )

    # Rename master to main if needed
    try:
        subprocess.run(
            ["git", "branch", "-M", "main"],
            cwd=repo_path,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        pass

    yield repo_path
    shutil.rmtree(temp_path)


class TestRepositoryManager:
    def test_init_default_base_dir(self):
        manager = RepositoryManager()
        assert manager.base_dir == Path("tmp_repos")

    def test_init_custom_base_dir(self, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        assert manager.base_dir == temp_dir

    def test_get_repository_path_from_env_var(self, mock_repo, monkeypatch):
        monkeypatch.setenv(ENV_VAR_NAMES["core"], str(mock_repo))

        manager = RepositoryManager()
        path = manager.get_repository_path("core")

        assert path == mock_repo

    def test_get_repository_path_env_var_not_set(self, monkeypatch):
        monkeypatch.delenv(ENV_VAR_NAMES["core"], raising=False)

        manager = RepositoryManager()
        path = manager.get_repository_path("core")

        assert path is None

    def test_get_repository_path_env_var_invalid_path(self, monkeypatch):
        monkeypatch.setenv(ENV_VAR_NAMES["core"], "/nonexistent/path")

        manager = RepositoryManager()
        path = manager.get_repository_path("core")

        assert path is None

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_clone_repository(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        target_path = temp_dir / "opentelemetry-collector-core"

        mock_run.return_value = MagicMock(returncode=0)

        manager._clone_repository("core", target_path)

        mock_run.assert_called_once_with(
            ["git", "clone", REPO_URLS["core"], str(target_path)],
            check=True,
            capture_output=True,
            text=True,
        )

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_clone_repository_failure_raises_runtime_error(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        target_path = temp_dir / "opentelemetry-collector-core"

        mock_run.side_effect = subprocess.CalledProcessError(1, "git clone", stderr="Clone failed")

        with pytest.raises(RuntimeError, match="Failed to clone"):
            manager._clone_repository("core", target_path)

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_pull_latest(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        mock_run.return_value = MagicMock(returncode=0)

        manager._pull_latest(temp_dir)

        assert mock_run.call_count == 2
        assert mock_run.call_args_list[0][0][0] == ["git", "checkout", "main"]
        assert mock_run.call_args_list[1][0][0] == ["git", "pull"]

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_pull_latest_failure_raises_runtime_error(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        mock_run.side_effect = subprocess.CalledProcessError(1, "git pull", stderr="Pull failed")

        with pytest.raises(RuntimeError, match="Failed to pull"):
            manager._pull_latest(temp_dir)

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_checkout_specified_version(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        version = Version.from_string("v1.0.0")
        mock_run.return_value = MagicMock(returncode=0)

        manager._checkout_version(temp_dir, version)

        assert mock_run.call_count == 2
        assert mock_run.call_args_list[0][0][0] == ["git", "fetch", "--tags"]
        assert mock_run.call_args_list[1][0][0] == ["git", "checkout", "v1.0.0"]

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_checkout_version_failure_raises_runtime_error(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        version = Version.from_string("v1.0.0")
        mock_run.side_effect = subprocess.CalledProcessError(1, "git checkout", stderr="Checkout failed")

        with pytest.raises(RuntimeError, match="Failed to checkout"):
            manager._checkout_version(temp_dir, version)

    def test_setup_repository_with_env_var_when_present(self, mock_repo, monkeypatch):
        monkeypatch.setenv(ENV_VAR_NAMES["core"], str(mock_repo))

        manager = RepositoryManager()
        path = manager.setup_repository("core", update=False)

        assert path == mock_repo

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_repository_with_env_var_and_version(self, mock_run, mock_repo, monkeypatch):
        monkeypatch.setenv(ENV_VAR_NAMES["core"], str(mock_repo))
        version = Version.from_string("v1.0.0")
        mock_run.return_value = MagicMock(returncode=0)

        manager = RepositoryManager()
        path = manager.setup_repository("core", version=version, update=False)

        assert path == mock_repo
        # Should have called git fetch and git checkout
        assert mock_run.call_count == 2

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_repository_clones_when_not_exists(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        mock_run.return_value = MagicMock(returncode=0)

        path = manager.setup_repository("core", update=False)

        expected_path = temp_dir / "opentelemetry-collector-core"
        assert path == expected_path
        # Should have called git clone
        mock_run.assert_called_once()
        assert mock_run.call_args[0][0][0] == "git"
        assert mock_run.call_args[0][0][1] == "clone"

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_repository_pulls_when_exists(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        repo_path = temp_dir / "opentelemetry-collector-core"
        repo_path.mkdir(parents=True)
        (repo_path / ".git").mkdir()

        mock_run.return_value = MagicMock(returncode=0)

        path = manager.setup_repository("core", update=True)

        assert path == repo_path
        # Should have called git checkout and git pull
        assert mock_run.call_count == 2

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_repository_no_update_when_exists(self, mock_run, temp_dir):
        """Test setup skips pull when update=False."""
        manager = RepositoryManager(str(temp_dir))
        repo_path = temp_dir / "opentelemetry-collector-core"
        repo_path.mkdir(parents=True)
        (repo_path / ".git").mkdir()

        path = manager.setup_repository("core", update=False)

        assert path == repo_path
        # Should not have called git commands
        mock_run.assert_not_called()

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_repository_with_version(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        version = Version.from_string("v1.2.3")
        mock_run.return_value = MagicMock(returncode=0)

        path = manager.setup_repository("core", version=version)

        expected_path = temp_dir / "opentelemetry-collector-core"
        assert path == expected_path
        # Should have called git clone, fetch, and checkout
        assert mock_run.call_count == 3

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_all_repositories(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        mock_run.return_value = MagicMock(returncode=0)

        paths = manager.setup_all_repositories(update=False)

        assert "core" in paths
        assert "contrib" in paths
        assert paths["core"] == temp_dir / "opentelemetry-collector-core"
        assert paths["contrib"] == temp_dir / "opentelemetry-collector-contrib"
        # Should have cloned both repos
        assert mock_run.call_count == 2

    @patch("collector_watcher.repository_manager.subprocess.run")
    def test_setup_all_repositories_with_version(self, mock_run, temp_dir):
        manager = RepositoryManager(str(temp_dir))
        version = Version.from_string("v1.0.0")
        mock_run.return_value = MagicMock(returncode=0)

        paths = manager.setup_all_repositories(version=version)

        assert "core" in paths
        assert "contrib" in paths
        # Should have cloned both repos and checked out versions
        # 2 clones + 2 * (fetch + checkout) = 6 calls
        assert mock_run.call_count == 6

    def test_setup_repository_creates_base_dir(self, temp_dir):
        """Test that setup creates base directory if it doesn't exist."""
        base_dir = temp_dir / "nested" / "repos"
        manager = RepositoryManager(str(base_dir))

        with patch("collector_watcher.repository_manager.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            manager.setup_repository("core", update=False)

        assert base_dir.exists()
