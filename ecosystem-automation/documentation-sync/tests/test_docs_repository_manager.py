"""Tests for DocsRepositoryManager."""

import os
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from documentation_sync.docs_repository_manager import (
    DEFAULT_REPOS_DIR,
    DOCS_REPO_ENV_VAR,
    DOCS_REPO_URL,
    DocsRepositoryManager,
)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def manager(temp_dir):
    return DocsRepositoryManager(base_dir=str(temp_dir))


class TestInit:
    def test_init_with_base_dir(self, temp_dir):
        manager = DocsRepositoryManager(base_dir=str(temp_dir))
        assert manager.base_dir == temp_dir

    def test_init_default_base_dir(self):
        manager = DocsRepositoryManager()
        assert manager.base_dir == Path(DEFAULT_REPOS_DIR)


class TestGetRepositoryPath:
    def test_no_env_var_set(self, manager):
        with patch.dict("os.environ", {}, clear=False):
            if DOCS_REPO_ENV_VAR in os.environ:
                del os.environ[DOCS_REPO_ENV_VAR]
            result = manager.get_repository_path()
            assert result is None

    def test_env_var_with_existing_path(self, manager, temp_dir):
        test_path = temp_dir / "test_repo"
        test_path.mkdir()

        with patch.dict("os.environ", {DOCS_REPO_ENV_VAR: str(test_path)}):
            result = manager.get_repository_path()
            assert result == test_path

    def test_env_var_with_nonexistent_path(self, manager, temp_dir):
        nonexistent_path = temp_dir / "nonexistent"

        with patch.dict("os.environ", {DOCS_REPO_ENV_VAR: str(nonexistent_path)}):
            result = manager.get_repository_path()
            assert result is None


class TestSetupRepository:
    def test_setup_with_env_var_existing_path(self, manager, temp_dir):
        env_repo_path = temp_dir / "env_repo"
        env_repo_path.mkdir()

        with patch.dict("os.environ", {DOCS_REPO_ENV_VAR: str(env_repo_path)}):
            with patch.object(manager, "_pull_latest") as mock_pull:
                result = manager.setup_repository(update=True)

                assert result == env_repo_path
                mock_pull.assert_called_once_with(env_repo_path)

    def test_setup_with_env_var_no_update(self, manager, temp_dir):
        env_repo_path = temp_dir / "env_repo"
        env_repo_path.mkdir()

        with patch.dict("os.environ", {DOCS_REPO_ENV_VAR: str(env_repo_path)}):
            with patch.object(manager, "_pull_latest") as mock_pull:
                result = manager.setup_repository(update=False)

                assert result == env_repo_path
                mock_pull.assert_not_called()

    def test_setup_clone_new_repository(self, manager, temp_dir):
        expected_path = temp_dir / "opentelemetry.io"

        with patch.dict("os.environ", {}, clear=False):
            if DOCS_REPO_ENV_VAR in os.environ:
                del os.environ[DOCS_REPO_ENV_VAR]
            with patch.object(manager, "_clone_repository") as mock_clone:
                result = manager.setup_repository(update=False)

                assert result == expected_path
                mock_clone.assert_called_once_with(expected_path)

    def test_setup_update_existing_repository(self, manager, temp_dir):
        repo_path = temp_dir / "opentelemetry.io"
        repo_path.mkdir()

        with patch.dict("os.environ", {}, clear=False):
            if DOCS_REPO_ENV_VAR in os.environ:
                del os.environ[DOCS_REPO_ENV_VAR]
            with patch.object(manager, "_pull_latest") as mock_pull:
                result = manager.setup_repository(update=True)

                assert result == repo_path
                mock_pull.assert_called_once_with(repo_path)

    def test_setup_no_update_existing_repository(self, manager, temp_dir):
        repo_path = temp_dir / "opentelemetry.io"
        repo_path.mkdir()

        with patch.dict("os.environ", {}, clear=False):
            if DOCS_REPO_ENV_VAR in os.environ:
                del os.environ[DOCS_REPO_ENV_VAR]
            with patch.object(manager, "_pull_latest") as mock_pull:
                result = manager.setup_repository(update=False)

                assert result == repo_path
                mock_pull.assert_not_called()


class TestCloneRepository:
    @patch("subprocess.run")
    def test_clone_success(self, mock_run, manager, temp_dir):
        target_path = temp_dir / "new_repo"
        mock_run.return_value = MagicMock()

        manager._clone_repository(target_path)

        mock_run.assert_called_once_with(
            ["git", "clone", DOCS_REPO_URL, str(target_path)],
            check=True,
            capture_output=True,
            text=True,
        )

    @patch("subprocess.run")
    def test_clone_creates_parent_directory(self, mock_run, manager, temp_dir):
        target_path = temp_dir / "nested" / "path" / "repo"
        mock_run.return_value = MagicMock()

        manager._clone_repository(target_path)

        assert target_path.parent.exists()
        mock_run.assert_called_once()

    @patch("subprocess.run")
    def test_clone_failure(self, mock_run, manager, temp_dir):
        target_path = temp_dir / "new_repo"
        mock_run.side_effect = subprocess.CalledProcessError(1, ["git", "clone"], stderr="Clone failed")

        with pytest.raises(RuntimeError, match="Failed to clone opentelemetry.io repository"):
            manager._clone_repository(target_path)


class TestPullLatest:
    @patch("subprocess.run")
    def test_pull_success(self, mock_run, manager, temp_dir):
        repo_path = temp_dir / "repo"
        repo_path.mkdir()
        mock_run.return_value = MagicMock()

        manager._pull_latest(repo_path)

        assert mock_run.call_count == 2
        mock_run.assert_any_call(
            ["git", "checkout", "main"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
        )
        mock_run.assert_any_call(
            ["git", "pull"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
        )

    @patch("subprocess.run")
    def test_pull_checkout_failure(self, mock_run, manager, temp_dir):
        repo_path = temp_dir / "repo"
        repo_path.mkdir()
        mock_run.side_effect = subprocess.CalledProcessError(1, ["git", "checkout"], stderr="Checkout failed")

        with pytest.raises(RuntimeError, match="Failed to pull latest changes"):
            manager._pull_latest(repo_path)

    @patch("subprocess.run")
    def test_pull_failure(self, mock_run, manager, temp_dir):
        repo_path = temp_dir / "repo"
        repo_path.mkdir()

        def side_effect(*args, **kwargs):
            if args[0] == ["git", "checkout", "main"]:
                return MagicMock()
            else:
                raise subprocess.CalledProcessError(1, ["git", "pull"], stderr="Pull failed")

        mock_run.side_effect = side_effect

        with pytest.raises(RuntimeError, match="Failed to pull latest changes"):
            manager._pull_latest(repo_path)
