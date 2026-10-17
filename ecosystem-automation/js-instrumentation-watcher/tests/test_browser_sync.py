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
from js_instrumentation_watcher.browser_sync import TAG_PREFIX, BrowserSync
from js_instrumentation_watcher.inventory_manager import InventoryManager
from watcher_common.testing import git_commit, init_repo, run_git


@pytest.fixture
def source(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    init_repo(repo)
    package_dir = repo / "packages/instrumentation"
    package_dir.mkdir(parents=True)

    def release(version, names):
        exports = {f"./experimental/{name}": "./build/index.js" for name in names}
        exports["./package.json"] = "./package.json"
        exports["./experimental/absent"] = "./absent.js"
        (package_dir / "package.json").write_text(
            json.dumps(
                {
                    "name": "@opentelemetry/browser-instrumentation",
                    "version": version,
                    "description": "Browser instrumentations",
                    "exports": exports,
                }
            )
        )
        for name in names:
            module = package_dir / "src" / name
            module.mkdir(parents=True, exist_ok=True)
            (module / "index.ts").write_text("export {};\n")
        run_git(repo, "add", ".")
        git_commit(repo, "test: package release")
        run_git(repo, "tag", f"{TAG_PREFIX}{version}")

    release("0.8.1", ["xhr", "console"])
    release("0.8.2", ["fetch", "console", "xhr"])
    run_git(repo, "tag", "browser-sdk-v99.0.0")
    run_git(repo, "tag", "browser-instrumentation-v1.0.0-rc.1")
    run_git(repo, "tag", "browser-instrumentation-vinvalid")
    # HEAD deliberately differs from every released manifest.
    (package_dir / "package.json").write_text('{"version":"99.0.0"}')
    return repo, release


def test_reads_tag_not_dirty_head_and_preserves_checkout(source, tmp_path):
    repo, _ = source
    before = run_git(repo, "status", "--porcelain")
    sync = BrowserSync(repo, InventoryManager(str(tmp_path / "registry")))
    data = sync.parse("0.8.1")
    assert data["version"] == "0.8.1"
    assert [m["name"] for m in data["modules"]] == ["console", "xhr"]
    assert data["modules"][0] == {
        "name": "console",
        "import_path": "@opentelemetry/browser-instrumentation/experimental/console",
        "source_path": "packages/instrumentation/src/console",
    }
    assert run_git(repo, "status", "--porcelain") == before


def test_backfill_and_rerun_are_immutable(source, tmp_path):
    repo, _ = source
    inventory = InventoryManager(str(tmp_path / "registry"))
    sync = BrowserSync(repo, inventory)
    with patch.object(sync.detector, "fetch_tags"):
        assert sync.sync() == {"new": ["0.8.2", "0.8.1"], "skipped": [], "failed": []}
        before = {p.name: p.read_bytes() for p in inventory.registry_dir.rglob("*.yaml")}
        assert sync.sync() == {"new": [], "skipped": ["0.8.2", "0.8.1"], "failed": []}
        assert before == {p.name: p.read_bytes() for p in inventory.registry_dir.rglob("*.yaml")}
    assert len(inventory.load("browser-instrumentation", "0.8.2")["modules"]) == 3


def test_bad_release_does_not_block_other_versions(source, tmp_path):
    repo, _ = source
    run_git(repo, "add", ".")
    git_commit(repo, "test: mismatched package version")
    run_git(repo, "tag", f"{TAG_PREFIX}0.9.0")
    sync = BrowserSync(repo, InventoryManager(str(tmp_path / "registry")))
    with patch.object(sync.detector, "fetch_tags"):
        result = sync.sync()
    assert result["failed"] == ["0.9.0"]
    assert result["new"] == ["0.8.2", "0.8.1"]


def test_fetch_detects_new_remote_tags(source, tmp_path):
    repo, release = source
    clone = tmp_path / "clone"
    run_git(tmp_path, "clone", str(repo), str(clone))
    release("0.8.3", ["console"])
    sync = BrowserSync(clone, InventoryManager(str(tmp_path / "registry")))
    assert sync.sync()["new"] == ["0.8.3", "0.8.2", "0.8.1"]


def test_missing_manifest_fails_release(source, tmp_path):
    repo, _ = source
    (repo / "packages/instrumentation/package.json").unlink()
    run_git(repo, "add", ".")
    git_commit(repo, "test: missing release manifest")
    run_git(repo, "tag", f"{TAG_PREFIX}0.9.0")
    sync = BrowserSync(repo, InventoryManager(str(tmp_path / "registry")))
    with patch.object(sync.detector, "fetch_tags"):
        result = sync.sync()
    assert result["failed"] == ["0.9.0"]
    assert result["new"] == ["0.8.2", "0.8.1"]


def test_fetch_failure_does_not_write_stale_registry(source, tmp_path):
    repo, _ = source
    inventory = InventoryManager(str(tmp_path / "registry"))
    sync = BrowserSync(repo, inventory)
    with patch.object(sync.detector, "fetch_tags", side_effect=RuntimeError("fetch failed")):
        with pytest.raises(RuntimeError, match="fetch failed"):
            sync.sync()
    assert not inventory.registry_dir.exists()
