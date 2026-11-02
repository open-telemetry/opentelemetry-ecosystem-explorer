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
import logging
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

    def release(
        version, names, description="Browser instrumentations", extra_exports=None, module_sources=None, **fields
    ):
        exports = {f"./experimental/{name}": "./build/index.js" for name in names}
        exports["./package.json"] = "./package.json"
        exports["./experimental/absent"] = "./absent.js"
        if extra_exports:
            exports.update(extra_exports)
        (package_dir / "package.json").write_text(
            json.dumps(
                {
                    "name": "@opentelemetry/browser-instrumentation",
                    "version": version,
                    "description": description,
                    "exports": exports,
                    **fields,
                }
            )
        )
        for name in names:
            module = package_dir / "src" / name
            module.mkdir(parents=True, exist_ok=True)
            (module / "index.ts").write_text("export {};\n")
            if module_sources and name in module_sources:
                (module / "instrumentation.ts").write_text(module_sources[name])
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


@pytest.mark.parametrize(
    "fields, expected",
    [
        ({"keywords": ["opentelemetry", "web"]}, "browser"),
        ({}, None),
        ({"keywords": []}, None),
        ({"keywords": ["browser"]}, None),
        ({"keywords": ["web-vitals"]}, None),
        ({"keywords": ["Web"]}, None),
        ({"keywords": None}, None),
        ({"keywords": "web"}, None),
        ({"keywords": {"web": True}}, None),
    ],
)
def test_platform_comes_from_release_keywords(source, tmp_path, fields, expected):
    repo, release = source
    release("0.8.3", ["console"], **fields)
    manifest = repo / "packages/instrumentation/package.json"
    package = json.loads(manifest.read_text())
    package["keywords"] = [] if expected else ["web"]
    manifest.write_text(json.dumps(package))
    inventory = InventoryManager(str(tmp_path / "registry"))
    sync = BrowserSync(repo, inventory)
    with patch.object(sync.detector, "fetch_tags"):
        assert sync.sync()["failed"] == []
    data = inventory.load("browser-instrumentation", "0.8.3")
    if expected:
        assert data["platform"] == expected
    else:
        assert "platform" not in data


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


@pytest.mark.parametrize(
    "call",
    [
        "super('@opentelemetry/browser-instrumentation/console', version, config);",
        'super("@opentelemetry/browser-instrumentation/console", version, config);',
        "super(\n  '@opentelemetry/browser-instrumentation/console',\n  version,\n  config\n);",
    ],
)
def test_scope_name_is_read_from_release_source(source, tmp_path, call):
    repo, release = source
    release("0.8.3", ["console", "xhr"], module_sources={"console": call})
    path = repo / "packages/instrumentation/src/console/instrumentation.ts"
    path.write_text("super('unreleased-scope', version, config);")
    inventory = InventoryManager(str(tmp_path / "registry"))
    sync = BrowserSync(repo, inventory)
    with patch.object(sync.detector, "fetch_tags"):
        assert sync.sync()["failed"] == []
    modules = inventory.load("browser-instrumentation", "0.8.3")["modules"]
    assert modules[0]["scope_name"] == "@opentelemetry/browser-instrumentation/console"
    assert "scope_name" not in modules[1]
    assert "scope_name" not in inventory.load("browser-instrumentation", "0.8.2")["modules"][0]
    assert path.read_text() == "super('unreleased-scope', version, config);"


@pytest.mark.parametrize(
    "call",
    [
        "super(SCOPE_NAME, version, config);",
        "super('', version, config);",
        "super(`scope-${name}`, version, config);",
        "super('scope-' + name, version, config);",
        "// super('commented-out', version, config);",
        "export {};",
    ],
)
def test_omits_scope_name_when_pattern_does_not_match(source, tmp_path, call, caplog):
    repo, release = source
    release("0.8.3", ["console"], module_sources={"console": call})
    with caplog.at_level(logging.WARNING, logger="js_instrumentation_watcher.browser_sync"):
        data = BrowserSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.3")
    assert data["modules"] == [
        {
            "name": "console",
            "import_path": "@opentelemetry/browser-instrumentation/experimental/console",
            "source_path": "packages/instrumentation/src/console",
        }
    ]
    assert (
        "js_instrumentation_watcher.browser_sync",
        logging.WARNING,
        "Missing browser scope_name for packages/instrumentation/src/console "
        "at refs/tags/browser-instrumentation-v0.8.3: pattern does not match",
    ) in caplog.record_tuples


def test_warns_when_instrumentation_source_is_missing(source, tmp_path, caplog):
    repo, _ = source
    with caplog.at_level(logging.WARNING, logger="js_instrumentation_watcher.browser_sync"):
        data = BrowserSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.1")
    assert all("scope_name" not in module for module in data["modules"])
    for name in ("console", "xhr"):
        assert (
            "js_instrumentation_watcher.browser_sync",
            logging.WARNING,
            f"Missing browser scope_name for packages/instrumentation/src/{name} "
            "at refs/tags/browser-instrumentation-v0.8.1: missing instrumentation.ts",
        ) in caplog.record_tuples


def test_matching_module_does_not_warn(source, tmp_path, caplog):
    repo, release = source
    release(
        "0.8.3",
        ["console"],
        module_sources={"console": "super('@opentelemetry/browser-instrumentation/console', version, config);"},
    )
    with caplog.at_level(logging.WARNING, logger="js_instrumentation_watcher.browser_sync"):
        data = BrowserSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.3")
    assert data["modules"][0]["scope_name"] == "@opentelemetry/browser-instrumentation/console"
    # The fixture's absent export still warns, but the matching module does not.
    assert len(caplog.record_tuples) == 1
    assert caplog.record_tuples[0] == (
        "js_instrumentation_watcher.browser_sync",
        logging.WARNING,
        "Skipping browser export ./experimental/absent at refs/tags/browser-instrumentation-v0.8.3: missing index.ts",
    )


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


def test_warns_on_skipped_exports_other_than_package_json(source, tmp_path, caplog):
    repo, release = source
    release("0.8.3", ["console"], extra_exports={"./stable/console": "./console.js"})
    sync = BrowserSync(repo, InventoryManager(str(tmp_path / "registry")))
    with caplog.at_level(logging.WARNING, logger="js_instrumentation_watcher.browser_sync"):
        data = sync.parse("0.8.3")
    assert [module["name"] for module in data["modules"]] == ["console"]
    assert "./experimental/absent" in caplog.text
    assert "missing index.ts" in caplog.text
    assert "./stable/console" in caplog.text
    assert "not an experimental export" in caplog.text
    assert "./package.json" not in caplog.text


def test_omits_empty_description(source, tmp_path):
    repo, release = source
    release("0.8.3", ["console"], description="")
    data = BrowserSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.3")
    assert "description" not in data
    kept = BrowserSync(repo, InventoryManager(str(tmp_path / "registry"))).parse("0.8.1")
    assert kept["description"] == "Browser instrumentations"


def test_fetch_failure_does_not_write_stale_registry(source, tmp_path):
    repo, _ = source
    inventory = InventoryManager(str(tmp_path / "registry"))
    sync = BrowserSync(repo, inventory)
    with patch.object(sync.detector, "fetch_tags", side_effect=RuntimeError("fetch failed")):
        with pytest.raises(RuntimeError, match="fetch failed"):
            sync.sync()
    assert not inventory.registry_dir.exists()
