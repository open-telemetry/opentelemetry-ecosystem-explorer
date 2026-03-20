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
"""Tests for repository manager."""

from unittest.mock import patch

import pytest
from configuration_watcher.repository_manager import (
    DEFAULT_REPO_NAME,
    ENV_VAR_NAME,
    RepositoryManager,
)


@pytest.fixture
def manager(tmp_path):
    return RepositoryManager(base_dir=str(tmp_path))


class TestRepositoryManager:
    def test_get_repository_path_from_env(self, manager, tmp_path):
        repo_path = tmp_path / "my-repo"
        repo_path.mkdir()

        with patch.dict("os.environ", {ENV_VAR_NAME: str(repo_path)}):
            result = manager.get_repository_path()

        assert result == repo_path

    def test_get_repository_path_env_nonexistent(self, manager):
        with patch.dict("os.environ", {ENV_VAR_NAME: "/nonexistent/path"}):
            result = manager.get_repository_path()

        assert result is None

    def test_get_repository_path_no_env(self, manager):
        with patch.dict("os.environ", {}, clear=True):
            result = manager.get_repository_path()

        assert result is None

    def test_setup_repository_clones_when_not_exists(self, manager, tmp_path):
        with (
            patch.dict("os.environ", {}, clear=True),
            patch("configuration_watcher.repository_manager.subprocess.run") as mock_run,
        ):
            result = manager.setup_repository()

        expected_path = tmp_path / DEFAULT_REPO_NAME
        assert result == expected_path
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert args[0] == "git"
        assert args[1] == "clone"

    def test_setup_repository_uses_env_var(self, manager, tmp_path):
        repo_path = tmp_path / "env-repo"
        repo_path.mkdir()

        with (
            patch.dict("os.environ", {ENV_VAR_NAME: str(repo_path)}),
            patch("configuration_watcher.repository_manager.subprocess.run") as mock_run,
        ):
            result = manager.setup_repository()

        assert result == repo_path
        # Should call: git checkout . + git checkout main + git pull
        assert mock_run.call_count == 3

    def test_setup_repository_pulls_when_exists(self, manager, tmp_path):
        repo_path = tmp_path / DEFAULT_REPO_NAME
        repo_path.mkdir()

        with (
            patch.dict("os.environ", {}, clear=True),
            patch("configuration_watcher.repository_manager.subprocess.run") as mock_run,
        ):
            result = manager.setup_repository()

        assert result == repo_path
        # Should call: git checkout . + git checkout main + git pull
        assert mock_run.call_count == 3
