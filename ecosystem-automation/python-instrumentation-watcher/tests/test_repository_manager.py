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

"""Tests for PythonContribRepositoryManager."""

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from python_instrumentation_watcher import repository_manager
from python_instrumentation_watcher.repository_manager import (
    REPO_ENV_VAR,
    REPO_NAME,
    REPO_URL,
    PythonContribRepositoryManager,
)
from watcher_common.repository_manager import _GIT
from watcher_common.testing import git_commit, init_repo, run_git


def _run_side_effect(tag_list_stdout: str = "v0.65b0\nv0.64b0\n"):
    """Build a subprocess.run side_effect that answers `git tag --list` with
    `tag_list_stdout` and everything else with a generic success — so every
    existing clone/pull/checkout assertion keeps working unchanged while the new
    tag-discovery call gets a real (fake) tag list to work with.
    """

    def _run(cmd, **kwargs):
        if cmd[:3] == [_GIT, "tag", "--list"]:
            return MagicMock(returncode=0, stdout=tag_list_stdout, stderr="")
        return MagicMock(returncode=0, stdout="", stderr="")

    return _run


def test_init_defaults_to_tmp_repos():
    manager = PythonContribRepositoryManager()

    assert manager.base_dir == Path("tmp_repos")


def test_init_honors_custom_base_dir(tmp_path):
    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))

    assert manager.base_dir == tmp_path


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_uses_env_var_path_when_it_exists(mock_run, tmp_path, monkeypatch):
    existing_repo = tmp_path / "local-python-contrib"
    existing_repo.mkdir()
    monkeypatch.setenv(REPO_ENV_VAR, str(existing_repo))

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))

    assert manager.setup() == existing_repo


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_does_not_touch_git_when_env_var_is_used(mock_run, tmp_path, monkeypatch):
    existing_repo = tmp_path / "local-python-contrib"
    existing_repo.mkdir()
    monkeypatch.setenv(REPO_ENV_VAR, str(existing_repo))

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    mock_run.assert_not_called()


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_falls_back_to_clone_when_env_var_path_is_missing(mock_run, tmp_path, monkeypatch):
    monkeypatch.setenv(REPO_ENV_VAR, str(tmp_path / "does-not-exist"))
    mock_run.side_effect = _run_side_effect()

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == tmp_path / REPO_NAME
    assert mock_run.call_args_list[0][0][0] == [_GIT, "clone", REPO_URL, str(tmp_path / REPO_NAME)]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_clones_when_repo_not_present(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = _run_side_effect()

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == tmp_path / REPO_NAME
    assert mock_run.call_args_list[0][0][0] == [_GIT, "clone", REPO_URL, str(tmp_path / REPO_NAME)]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_pulls_when_repo_already_present(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    repo_path = tmp_path / REPO_NAME
    repo_path.mkdir()
    mock_run.side_effect = _run_side_effect()

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    path = manager.setup()

    assert path == repo_path
    assert mock_run.call_args_list[0][0][0] == [_GIT, "checkout", "main"]
    assert mock_run.call_args_list[1][0][0] == [_GIT, "pull"]


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_raises_when_clone_fails(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = subprocess.CalledProcessError(1, "git clone", stderr="Clone failed")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Failed to clone"):
        manager.setup()


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_raises_when_pull_fails(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    (tmp_path / REPO_NAME).mkdir()
    mock_run.side_effect = subprocess.CalledProcessError(1, "git pull", stderr="Pull failed")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Failed to pull"):
        manager.setup()


def test_repo_constants_point_at_python_contrib():
    assert REPO_NAME == "opentelemetry-python-contrib"
    assert REPO_URL.endswith("opentelemetry-python-contrib.git")
    assert REPO_ENV_VAR == "PYTHON_CONTRIB_REPO_PATH"


# --- _checkout_latest_release ------------------------------------------------


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_checks_out_latest_release_tag_after_cloning(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = _run_side_effect("v0.65b0\nv0.64b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    commands = [call[0][0] for call in mock_run.call_args_list]
    assert [_GIT, "tag", "--list", "--sort=-creatordate"] in commands
    assert [_GIT, "checkout", "v0.65b0"] in commands


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_checks_out_latest_release_tag_after_pulling(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    (tmp_path / REPO_NAME).mkdir()
    mock_run.side_effect = _run_side_effect("v0.65b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    commands = [call[0][0] for call in mock_run.call_args_list]
    assert [_GIT, "checkout", "v0.65b0"] in commands


@patch("watcher_common.repository_manager.subprocess.run")
def test_setup_does_not_checkout_a_release_tag_when_env_var_is_used(mock_run, tmp_path, monkeypatch):
    """An explicit local checkout is never touched — no clone/pull, and no tag
    checkout either. Regression guard alongside test_setup_does_not_touch_git_when_env_var_is_used."""
    existing_repo = tmp_path / "local-python-contrib"
    existing_repo.mkdir()
    monkeypatch.setenv(REPO_ENV_VAR, str(existing_repo))

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    mock_run.assert_not_called()


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_picks_the_first_matching_tag(mock_run, tmp_path, monkeypatch):
    """git tag --list --sort=-creatordate already returns newest-first; the first
    tag matching the repo-wide release shape is used, skipping anything that
    doesn't look like a plain "v<version>" tag. Fixture uses the actual upstream
    independent-package tag format observed on a live clone of
    opentelemetry-python-contrib: "<package>==<version>", e.g.
    "opentelemetry-instrumentation-openai-v2==2.4b0" — not "v"-prefixed at all,
    so it can never collide with the repo-wide "v<version>" shape.
    """
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = _run_side_effect("opentelemetry-instrumentation-openai-v2==2.4b0\nv0.65b0\nv0.64b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    commands = [call[0][0] for call in mock_run.call_args_list]
    assert [_GIT, "checkout", "v0.65b0"] in commands
    assert [_GIT, "checkout", "opentelemetry-instrumentation-openai-v2==2.4b0"] not in commands


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_picks_the_current_tag_over_an_old_same_shaped_one(mock_run, tmp_path, monkeypatch):
    """The exact real-world case: a live clone of opentelemetry-python-contrib has
    both "v1.16.0" (an old, unrelated tag from 2023 — predates the repo's current
    "v0.NNbM" lockstep numbering) and "v0.65b0" (the actual current release),
    both matching the bare "v<version>" shape. `--sort=-creatordate` lists the
    genuinely newest tag first regardless of how its version number compares —
    verified against the live tag creation dates: v0.65b0 (2026-07-16) sorts
    ahead of v1.16.0 (2023-02-17) even though "1.16.0" numerically looks larger
    than "0.65b0".
    """
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    # Already in git's own newest-first creatordate order, as observed live.
    mock_run.side_effect = _run_side_effect("v0.65b0\nv0.64b0\nv1.16.0\nv0.36b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    manager.setup()

    commands = [call[0][0] for call in mock_run.call_args_list]
    assert [_GIT, "checkout", "v0.65b0"] in commands
    assert [_GIT, "checkout", "v1.16.0"] not in commands


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_strips_the_v_prefix_before_reusing_checkout_version(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = _run_side_effect("v0.65b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    with patch.object(manager, "_checkout_version") as mock_checkout_version:
        manager.setup()

    # _checkout_version itself reconstructs the "v" prefix (f"v{version}"), so it
    # must be called with the bare suffix, not "v0.65b0" again.
    mock_checkout_version.assert_called_once_with(tmp_path / REPO_NAME, "0.65b0")


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_warns_and_continues_when_no_tag_found(mock_run, tmp_path, monkeypatch, caplog):
    import logging

    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    mock_run.side_effect = _run_side_effect("")  # no tags at all

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    logger_name = "python_instrumentation_watcher.repository_manager"
    with caplog.at_level(logging.WARNING, logger=logger_name):
        path = manager.setup()  # must not raise

    assert path == tmp_path / REPO_NAME
    assert "No release tag found" in caplog.text
    commands = [call[0][0] for call in mock_run.call_args_list]
    assert not any(cmd[:2] == [_GIT, "checkout"] and cmd[-1] != "main" for cmd in commands)


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_ignores_non_version_shaped_tags(mock_run, tmp_path, monkeypatch, caplog):
    import logging

    monkeypatch.delenv(REPO_ENV_VAR, raising=False)
    # Only a per-package-style tag exists — no bare "v<version>" repo-wide tag.
    mock_run.side_effect = _run_side_effect("opentelemetry-instrumentation-openai-v2==2.4b0\n")

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))
    logger_name = "python_instrumentation_watcher.repository_manager"
    with caplog.at_level(logging.WARNING, logger=logger_name):
        manager.setup()

    assert "No release tag found" in caplog.text


@patch("watcher_common.repository_manager.subprocess.run")
def test_checkout_latest_release_raises_when_tag_listing_fails(mock_run, tmp_path, monkeypatch):
    monkeypatch.delenv(REPO_ENV_VAR, raising=False)

    def _run(cmd, **kwargs):
        if cmd[:3] == [_GIT, "tag", "--list"]:
            raise subprocess.CalledProcessError(1, cmd, stderr="tag listing failed")
        return MagicMock(returncode=0, stdout="", stderr="")

    mock_run.side_effect = _run

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Failed to list tags"):
        manager.setup()


# --- Real-git integration test ------------------------------------------------
#
# Every test above mocks subprocess.run — a real python-contrib clone behavior
# (e.g. how git actually orders/creates tags, or how a real checkout leaves the
# working tree) can't be wrong in a way those tests would catch, since the mock
# always answers exactly what the test tells it to. This test instead runs real
# git commands against a real local repository, built with the same
# watcher_common.testing helpers collector-watcher's repository_manager tests
# already use for this purpose (see mock_repo in
# collector-watcher/tests/test_repository_manager.py). It clones from that real
# local repo (not the network), so it's still self-contained and offline.
#
# This was additionally cross-checked against a live clone of the real
# opentelemetry-python-contrib repository during development of this fix: fresh
# clone, repeated setup() calls simulating consecutive nightly runs, tag
# selection against the actual ~100-tag set (including the real "v1.16.0"
# anomaly), and a full sync() against all 51 real in-scope packages all resolved
# and behaved as this test (and the ones above) assert. That live validation
# isn't itself part of the automated suite — it required network access to
# github.com, which sandboxed CI does not have — so this fixture is what keeps
# that behavior provable from the repository itself going forward.


def test_setup_resolves_a_real_release_version_not_mains_dev_placeholder(tmp_path, monkeypatch):
    """End-to-end regression, using real git operations throughout: main's
    version.py always carries the next unreleased .dev version, which never
    changes across a release cycle. Before the release-tag-checkout fix, reading
    __version__ straight off main would return that permanently-stable .dev
    string, which would make InventoryManager.version_exists() treat every
    subsequent run as already tracked and the registry would never advance.
    Checking out the release tag first must make the working tree's version.py
    resolve to the real, released version string instead.
    """
    # Build a real "upstream" repo shaped like python-contrib: an old commit
    # tagged as a clean release, and main has since advanced to a dev version.
    origin = tmp_path / "origin"
    origin.mkdir()
    init_repo(origin)
    version_file = origin / "version.py"

    version_file.write_text('__version__ = "0.65b0"\n')
    run_git(origin, "add", ".")
    git_commit(origin, "Prepare release 0.65b0")
    # git's initial-branch-name default is environment-dependent (varies with
    # init.defaultBranch — e.g. local dev machines default to "main" while a
    # clean CI runner may default to "master"), but _pull_latest hardcodes
    # "git checkout main" to match the real opentelemetry-python-contrib repo's
    # actual default branch. The synthetic origin here must be pinned to "main"
    # explicitly rather than relying on whatever `git init` happened to default
    # to — same pattern as collector-watcher's `mock_repo` fixture
    # (collector-watcher/tests/test_repository_manager.py).
    try:
        run_git(origin, "checkout", "-b", "main")
    except subprocess.CalledProcessError:
        run_git(origin, "checkout", "main")
    run_git(origin, "tag", "v0.65b0")

    version_file.write_text('__version__ = "0.66b0.dev"\n')
    run_git(origin, "add", ".")
    git_commit(origin, "Update version to 0.66b0.dev")

    # Redirect the managed clone at the real local repo above instead of the
    # network URL — everything else (clone, tag listing, checkout) is the
    # watcher's real, unmodified code path.
    monkeypatch.setattr(repository_manager, "REPO_URL", str(origin))

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path / "clones"))
    repo_path = manager.setup()

    resolved_version = (repo_path / "version.py").read_text()
    assert "0.65b0" in resolved_version
    assert "dev" not in resolved_version


def test_setup_still_resolves_the_release_version_on_a_second_run(tmp_path, monkeypatch):
    """The scenario the original bug report described directly: a *second*
    nightly run against an *existing* local clone (the pull path, not the clone
    path) must still land on the release tag — not silently stay on whatever
    main happens to be, which is exactly how the registry froze before this fix.
    """
    origin = tmp_path / "origin"
    origin.mkdir()
    init_repo(origin)
    version_file = origin / "version.py"

    version_file.write_text('__version__ = "0.65b0"\n')
    run_git(origin, "add", ".")
    git_commit(origin, "Prepare release 0.65b0")
    # git's initial-branch-name default is environment-dependent (varies with
    # init.defaultBranch — e.g. local dev machines default to "main" while a
    # clean CI runner may default to "master"), but _pull_latest hardcodes
    # "git checkout main" to match the real opentelemetry-python-contrib repo's
    # actual default branch. The synthetic origin here must be pinned to "main"
    # explicitly rather than relying on whatever `git init` happened to default
    # to — same pattern as collector-watcher's `mock_repo` fixture
    # (collector-watcher/tests/test_repository_manager.py).
    try:
        run_git(origin, "checkout", "-b", "main")
    except subprocess.CalledProcessError:
        run_git(origin, "checkout", "main")
    run_git(origin, "tag", "v0.65b0")

    version_file.write_text('__version__ = "0.66b0.dev"\n')
    run_git(origin, "add", ".")
    git_commit(origin, "Update version to 0.66b0.dev")

    monkeypatch.setattr(repository_manager, "REPO_URL", str(origin))

    manager = PythonContribRepositoryManager(base_dir=str(tmp_path / "clones"))
    manager.setup()  # first run: clones fresh
    repo_path = manager.setup()  # second run: pulls the existing clone

    resolved_version = (repo_path / "version.py").read_text()
    assert "0.65b0" in resolved_version
    assert "dev" not in resolved_version
