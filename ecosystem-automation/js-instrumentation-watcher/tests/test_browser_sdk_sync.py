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

"""Release provenance and incremental browser synchronization tests."""

import json
from unittest.mock import patch

import pytest
from js_instrumentation_watcher.browser_sdk_sync import BrowserSdkSync
from js_instrumentation_watcher.inventory_manager import InventoryManager
from watcher_common.testing import git_commit, init_repo, run_git


@pytest.fixture
def sdk_source(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    init_repo(repo)
    package_dir = repo / "packages/sdk"
    package_dir.mkdir(parents=True)

    def release(tag_version, **fields):
        (package_dir / "package.json").write_text(
            json.dumps(
                {
                    "name": "@opentelemetry/browser-sdk",
                    "version": tag_version,
                    "description": "Browser SDK",
                    "keywords": ["web", "sdk"],
                    "exports": {".": "./dist/index.js", "./logs": "./dist/logs/index.js"},
                    **fields,
                }
            )
        )
        run_git(repo, "add", ".")
        git_commit(repo, "test: SDK release")
        run_git(repo, "tag", f"browser-sdk-v{tag_version}")

    release("0.6.0")
    release("0.7.0")
    run_git(repo, "tag", "browser-instrumentation-v99.0.0")
    run_git(repo, "tag", "browser-sdk-v1.0.0-rc.1")
    (package_dir / "package.json").write_text('{"version":"99.0.0"}')
    return repo, release


def test_sdk_backfill_uses_own_tags_and_preserves_existing_releases(sdk_source, tmp_path):
    repo, _ = sdk_source
    inventory = InventoryManager(str(tmp_path / "registry"))
    inventory.save("browser-instrumentation", "0.10.0", {"name": "browser-instrumentation"})
    sync = BrowserSdkSync(repo, inventory)
    before_head = run_git(repo, "status", "--porcelain")
    with patch.object(sync.detector, "fetch_tags"):
        assert sync.sync() == {"new": ["0.7.0", "0.6.0"], "skipped": [], "failed": []}
        before = {p: p.read_bytes() for p in inventory.registry_dir.rglob("*.yaml")}
        assert sync.sync() == {"new": [], "skipped": ["0.7.0", "0.6.0"], "failed": []}
        assert before == {p: p.read_bytes() for p in inventory.registry_dir.rglob("*.yaml")}
    assert inventory.load("browser-sdk", "0.7.0") == {
        "name": "browser-sdk",
        "npm_package": "@opentelemetry/browser-sdk",
        "version": "0.7.0",
        "repository": "open-telemetry/opentelemetry-browser",
        "source_path": "packages/sdk",
        "package_type": "sdk",
        "platform": "browser",
        "description": "Browser SDK",
    }
    assert run_git(repo, "status", "--porcelain") == before_head


@pytest.mark.parametrize("fields", [{"name": "wrong"}, {"version": "wrong"}])
def test_mismatched_sdk_release_does_not_block_other_versions(sdk_source, tmp_path, fields):
    repo, release = sdk_source
    release("0.8.0", **fields)
    sync = BrowserSdkSync(repo, InventoryManager(str(tmp_path / "registry")))
    with patch.object(sync.detector, "fetch_tags"):
        result = sync.sync()
    assert result["failed"] == ["0.8.0"]
    assert result["new"] == ["0.7.0", "0.6.0"]


def test_missing_sdk_manifest_fails_only_its_release(sdk_source, tmp_path):
    repo, _ = sdk_source
    (repo / "packages/sdk/package.json").unlink()
    run_git(repo, "add", ".")
    git_commit(repo, "test: missing SDK manifest")
    run_git(repo, "tag", "browser-sdk-v0.8.0")
    sync = BrowserSdkSync(repo, InventoryManager(str(tmp_path / "registry")))
    with patch.object(sync.detector, "fetch_tags"):
        result = sync.sync()
    assert result["failed"] == ["0.8.0"]
    assert result["new"] == ["0.7.0", "0.6.0"]


@pytest.mark.parametrize("keywords", [None, [], "web", ["Web"]])
def test_sdk_omits_absent_metadata(sdk_source, tmp_path, keywords):
    repo, release = sdk_source
    release("0.8.0", description="", keywords=keywords)
    entry = BrowserSdkSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.0")
    assert "description" not in entry
    assert "platform" not in entry
    assert "modules" not in entry
    assert "node_engine" not in entry
