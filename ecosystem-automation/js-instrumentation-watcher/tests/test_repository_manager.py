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

"""Tests for JsContribRepositoryManager."""

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from js_instrumentation_watcher.repository_manager import (
    REPO_ENV_VAR,
    REPO_NAME,
    REPO_URL,
    JsContribRepositoryManager,
)
from watcher_common.repository_manager import _GIT


def test_init_defaults_to_tmp_repos():
    manager = JsContribRepositoryManager()

    assert manager.base_dir == Path("tmp_repos")


def test_init_honors_custom_base_dir(tmp_path):
    manager = JsContribRepositoryManager(base_dir=str(tmp_path))

    assert manager.base_dir == tmp_path


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_uses_env_var_path_when_it_exists(mock_run, tmp_path, monkeypatch):
    existing_repo = tmp_path / "local-js-contrib"
    existing_repo.mkdir()
    monkeypatch.setenv(REPO_ENV_VAR, str(existing_repo))

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))

    assert manager.setup() == existing_repo


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_does_not_touch_git_when_env_var_is_used(mock_run, tmp_path, monkeypatch):
    existing_repo = tmp_path / "local-js-contrib"
    existing_repo.mkdir()
    monkeypatch.setenv(REPO_ENV_VAR, str(existing_repo))

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    mock_run.assert_not_called()


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_falls_back_to_clone_when_env_var_path_is_missing(mock_run, tmp_path, monkeypatch):
    monkeypatch.setenv(REPO_ENV_VAR, str(tmp_path / "does-not-exist"))
    mock_run.return_value = MagicMock(returncode=0)

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == tmp_path / REPO_NAME
    assert mock_run.call_args[0][0] == [_GIT, "clone", REPO_URL, str(tmp_path / REPO_NAME)]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_clones_when_repo_not_present(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.return_value = MagicMock(returncode=0)

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == tmp_path / REPO_NAME
    mock_run.assert_called_once()
    assert mock_run.call_args[0][0] == [_GIT, "clone", REPO_URL, str(tmp_path / REPO_NAME)]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_pulls_when_repo_already_present(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    repo_path = tmp_path / REPO_NAME
    repo_path.mkdir()
    mock_run.return_value = MagicMock(returncode=0)

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == repo_path
    assert mock_run.call_count == 2
    assert mock_run.call_args_list[0][0][0] == [_GIT, "checkout", "main"]
    assert mock_run.call_args_list[1][0][0] == [_GIT, "pull"]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_raises_when_clone_fails(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = subprocess.CalledProcessError(1, "git clone", stderr="Clone failed")

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Failed to clone"):
        manager.setup()


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_raises_when_pull_fails(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    (tmp_path / REPO_NAME).mkdir()
    mock_run.side_effect = subprocess.CalledProcessError(1, "git pull", stderr="Pull failed")

    manager = JsContribRepositoryManager(base_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Failed to pull"):
        manager.setup()


def test_repo_constants_point_at_js_contrib():
    assert REPO_NAME == "opentelemetry-js-contrib"
    assert REPO_URL.endswith("opentelemetry-js-contrib.git")
    assert REPO_ENV_VAR == "JS_CONTRIB_REPO_PATH"
