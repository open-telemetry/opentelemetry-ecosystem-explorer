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

"""Tests for the JS instrumentation watcher entry point."""

import logging
from pathlib import Path
from unittest.mock import patch

import pytest
from js_instrumentation_watcher.main import REGISTRY_DIR, configure_logging, main


@pytest.fixture
def wiring():
    """Patch the three collaborators main() wires together."""
    with (
        patch("js_instrumentation_watcher.main.JsContribRepositoryManager") as repo_manager,
        patch("js_instrumentation_watcher.main.InventoryManager") as inventory_manager,
        patch("js_instrumentation_watcher.main.InstrumentationSync") as sync,
    ):
        repo_manager.return_value.setup.return_value = Path("/repos/opentelemetry-js-contrib")
        sync.return_value.sync.return_value = {"new": [], "skipped": [], "failed": []}
        yield repo_manager, inventory_manager, sync


def test_main_returns_none_on_success(wiring, monkeypatch):
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    assert main() is None


def test_main_defaults_base_dir_to_tmp_repos(wiring, monkeypatch):
    repo_manager, _, _ = wiring
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    main()

    repo_manager.assert_called_once_with(base_dir="tmp_repos")


def test_main_honors_repos_dir_env_var(wiring, monkeypatch):
    repo_manager, _, _ = wiring
    monkeypatch.setenv("JS_CONTRIB_REPOS_DIR", "custom_repos")

    main()

    repo_manager.assert_called_once_with(base_dir="custom_repos")


def test_main_builds_inventory_manager_with_registry_dir(wiring, monkeypatch):
    _, inventory_manager, _ = wiring
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    main()

    inventory_manager.assert_called_once_with(registry_dir=REGISTRY_DIR)


def test_main_passes_resolved_repo_path_and_inventory_to_sync(wiring, monkeypatch):
    repo_manager, inventory_manager, sync = wiring
    repo_manager.return_value.setup.return_value = Path("/repos/resolved-js-contrib")
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    main()

    sync.assert_called_once_with(
        repo_path=Path("/repos/resolved-js-contrib"),
        inventory_manager=inventory_manager.return_value,
    )


def test_main_runs_the_sync(wiring, monkeypatch):
    _, _, sync = wiring
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    main()

    sync.return_value.sync.assert_called_once_with()


def test_main_logs_the_sync_summary(wiring, monkeypatch, caplog):
    _, _, sync = wiring
    sync.return_value.sync.return_value = {
        "new": ["instrumentation-express@0.66.0"],
        "skipped": [],
        "failed": [],
    }
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    with caplog.at_level(logging.INFO, logger="js_instrumentation_watcher.main"):
        main()

    assert "instrumentation-express@0.66.0" in caplog.text


def test_main_propagates_repository_setup_failure(wiring, monkeypatch):
    repo_manager, _, sync = wiring
    repo_manager.return_value.setup.side_effect = RuntimeError("Failed to clone repository")
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    with pytest.raises(RuntimeError, match="Failed to clone"):
        main()

    sync.return_value.sync.assert_not_called()


def test_main_propagates_sync_failure(wiring, monkeypatch):
    _, _, sync = wiring
    sync.return_value.sync.side_effect = RuntimeError("sync exploded")
    monkeypatch.delenv("JS_CONTRIB_REPOS_DIR", raising=False)

    with pytest.raises(RuntimeError, match="sync exploded"):
        main()


def test_registry_dir_points_at_javascript_registry():
    assert REGISTRY_DIR == "ecosystem-registry/javascript"


def test_configure_logging_sets_info_level():
    root_logger = logging.getLogger()
    original_level = root_logger.level
    original_handlers = root_logger.handlers[:]
    try:
        root_logger.handlers.clear()
        root_logger.setLevel(logging.NOTSET)

        configure_logging()

        assert root_logger.level == logging.INFO
        assert root_logger.handlers
    finally:
        root_logger.handlers[:] = original_handlers
        root_logger.setLevel(original_level)
