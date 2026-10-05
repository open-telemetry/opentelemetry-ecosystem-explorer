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
"""Tests for javascript_builder module."""

import json
from unittest.mock import MagicMock

import pytest
from explorer_db_builder.javascript_builder import run_javascript_builder
from explorer_db_builder.javascript_database_writer import JavascriptDatabaseWriter
from js_instrumentation_watcher.inventory_manager import InventoryManager


def _release(name: str, version: str, **extra) -> dict:
    """A registry release shaped like what the watcher writes."""
    return {
        "name": name,
        "npm_package": f"@opentelemetry/{name}",
        "version": version,
        "description": f"Instrumentation for {name}",
        "repository": "open-telemetry/opentelemetry-js-contrib",
        "component_owners": ["someone"],
        "in_auto_instrumentations_node": True,
        **extra,
    }


@pytest.fixture
def registry(tmp_path):
    """A small registry written through the watcher's own InventoryManager."""
    manager = InventoryManager(registry_dir=str(tmp_path / "registry"))
    # Two express releases that differ only in version, like most of the real registry.
    for version in ("0.9.0", "0.10.0"):
        manager.save("instrumentation-express", version, _release("instrumentation-express", version))
    manager.save(
        "instrumentation-oracledb",
        "0.47.0",
        _release("instrumentation-oracledb", "0.47.0", in_auto_instrumentations_node=False),
    )
    return manager


@pytest.fixture
def writer(tmp_path):
    return JavascriptDatabaseWriter(str(tmp_path / "javascript"))


def _read(path):
    return json.loads(path.read_text())


def _index_entry(writer, name):
    return next(p for p in _read(writer.database_dir / "index.json")["packages"] if p["name"] == name)


def _package_for(writer, name, version):
    """Follow index.json to the package file a release uses."""
    entry = _index_entry(writer, name)
    package_hash = next(r["hash"] for r in entry["releases"] if r["version"] == version)
    return _read(writer.database_dir / "packages" / name / f"{name}-{package_hash}.json")


def test_success_writes_only_index_and_packages(registry, writer):
    assert run_javascript_builder(inventory_manager=registry, db_writer=writer) == 0

    db = writer.database_dir
    assert sorted(p.name for p in db.iterdir()) == ["index.json", "packages"]


def test_releases_differing_only_in_version_share_one_file(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    express = _index_entry(writer, "instrumentation-express")
    assert express["releases"][0]["hash"] == express["releases"][1]["hash"]
    assert len(list((writer.database_dir / "packages" / "instrumentation-express").iterdir())) == 1


def test_releases_with_different_metadata_get_separate_files(registry, writer):
    registry.save(
        "instrumentation-express",
        "0.11.0",
        _release("instrumentation-express", "0.11.0", node_engine=">=20"),
    )

    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    assert _package_for(writer, "instrumentation-express", "0.11.0")["node_engine"] == ">=20"
    assert "node_engine" not in _package_for(writer, "instrumentation-express", "0.10.0")
    assert len(list((writer.database_dir / "packages" / "instrumentation-express").iterdir())) == 2


def test_package_file_drops_unpublished_fields(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    assert _package_for(writer, "instrumentation-oracledb", "0.47.0") == {
        "name": "instrumentation-oracledb",
        "npm_package": "@opentelemetry/instrumentation-oracledb",
        "description": "Instrumentation for instrumentation-oracledb",
        "in_auto_instrumentations_node": False,
    }


def test_package_file_keeps_published_fields(registry, writer):
    tested = [{"package": "oracledb", "range": "6.7.0", "source": ".tav.yml"}]
    supported = [{"package": "oracledb", "version_range": ">=6.7.0 <7", "source": "README.md"}]
    registry.save(
        "instrumentation-oracledb",
        "0.48.0",
        _release(
            "instrumentation-oracledb",
            "0.48.0",
            source_path="packages/instrumentation-oracledb",
            node_engine="^18.19.0 || >=20.6.0",
            supported_versions=supported,
            tested_versions=tested,
        ),
    )

    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    package = _package_for(writer, "instrumentation-oracledb", "0.48.0")
    assert package["source_path"] == "packages/instrumentation-oracledb"
    assert package["node_engine"] == "^18.19.0 || >=20.6.0"
    assert package["supported_versions"] == supported
    assert package["tested_versions"] == tested


def test_index_lists_releases_newest_first_by_semver(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    express = _index_entry(writer, "instrumentation-express")
    # Sorted as text, 0.9.0 would come before 0.10.0.
    assert express["version"] == "0.10.0"
    assert [r["version"] for r in express["releases"]] == ["0.10.0", "0.9.0"]


def test_index_metadata_comes_from_newest_release(registry, writer):
    registry.save(
        "instrumentation-express",
        "0.11.0",
        _release("instrumentation-express", "0.11.0", description="Reworded upstream"),
    )

    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    assert _index_entry(writer, "instrumentation-express")["description"] == "Reworded upstream"


def test_index_entry_shape(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    index = _read(writer.database_dir / "index.json")
    assert index["ecosystem"] == "javascript"
    assert [p["name"] for p in index["packages"]] == ["instrumentation-express", "instrumentation-oracledb"]
    oracledb = index["packages"][1]
    assert oracledb == {
        "name": "instrumentation-oracledb",
        "npm_package": "@opentelemetry/instrumentation-oracledb",
        "description": "Instrumentation for instrumentation-oracledb",
        "in_auto_instrumentations_node": False,
        "version": "0.47.0",
        "releases": [{"version": "0.47.0", "hash": oracledb["releases"][0]["hash"]}],
    }


def test_rebuild_is_byte_identical(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)
    first = {p: p.read_bytes() for p in writer.database_dir.rglob("*.json")}

    run_javascript_builder(inventory_manager=registry, db_writer=writer)
    second = {p: p.read_bytes() for p in writer.database_dir.rglob("*.json")}

    assert first == second


def test_returns_1_when_registry_empty(tmp_path, writer):
    empty = InventoryManager(registry_dir=str(tmp_path / "empty"))

    assert run_javascript_builder(inventory_manager=empty, db_writer=writer) == 1


def test_returns_1_on_name_mismatch(registry, writer):
    registry.save("instrumentation-pg", "0.60.0", _release("instrumentation-mysql", "0.60.0"))

    assert run_javascript_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unparseable_version(registry, writer):
    registry.save("instrumentation-pg", "latest", _release("instrumentation-pg", "latest"))

    assert run_javascript_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unhashable_value(registry, writer):
    # An unquoted date in YAML loads as datetime.date, which isn't JSON, so
    # hashing raises TypeError. That must fail the build, not crash it.
    path = registry.registry_dir / "instrumentation-pg" / "v0.60.0.yaml"
    path.parent.mkdir()
    path.write_text("name: instrumentation-pg\nversion: 0.60.0\nnode_engine: 2026-09-30\n")

    assert run_javascript_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_write_failure(registry):
    failing = MagicMock()
    failing.write_package.side_effect = OSError("disk full")

    assert run_javascript_builder(inventory_manager=registry, db_writer=failing) == 1


def test_removes_orphans_when_incremental(registry, writer):
    run_javascript_builder(inventory_manager=registry, db_writer=writer)
    stale = writer.database_dir / "packages" / "instrumentation-express" / "instrumentation-express-000000000000.json"
    stale.write_text("{}")

    run_javascript_builder(inventory_manager=registry, db_writer=writer)

    assert not stale.exists()


def test_clean_wipes_before_building(registry, writer):
    writer.database_dir.mkdir(parents=True)
    leftover = writer.database_dir / "leftover.json"
    leftover.write_text("{}")

    assert run_javascript_builder(inventory_manager=registry, db_writer=writer, clean=True) == 0

    assert not leftover.exists()
    assert (writer.database_dir / "index.json").exists()


def test_skips_orphan_gc_when_clean(registry):
    mock_writer = MagicMock()
    mock_writer.write_package.return_value = "abc123def456"
    mock_writer.get_stats.return_value = {"files_written": 0, "total_bytes": 0}

    run_javascript_builder(inventory_manager=registry, db_writer=mock_writer, clean=True)

    mock_writer.clean.assert_called_once()
    mock_writer.remove_orphans.assert_not_called()
