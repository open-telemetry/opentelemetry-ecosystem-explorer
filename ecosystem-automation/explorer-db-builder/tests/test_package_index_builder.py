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
"""Tests for the build loop shared by the javascript and python pipelines.

Each test runs once per ecosystem through its public ``run_<ecosystem>_builder``, so a regression in
the shared loop or in either ecosystem's wiring fails here. Ecosystem-specific output (published
fields, version ordering) is tested in test_javascript_builder.py and test_python_builder.py.
"""

import json
from dataclasses import dataclass
from typing import Any, Callable
from unittest.mock import MagicMock

import pytest
from explorer_db_builder.javascript_builder import run_javascript_builder
from explorer_db_builder.javascript_database_writer import JavascriptDatabaseWriter
from explorer_db_builder.python_builder import run_python_builder
from explorer_db_builder.python_database_writer import PythonDatabaseWriter
from js_instrumentation_watcher.inventory_manager import InventoryManager as JsInventoryManager
from python_instrumentation_watcher.inventory_manager import InventoryManager as PythonInventoryManager


@dataclass(frozen=True)
class Ecosystem:
    name: str
    run: Callable[..., int]
    manager: type
    writer: type
    pkg: str
    other_pkg: str
    versions: tuple[str, str]
    bad_version: str
    published_field: str  # a field the pipeline publishes, so a bad value reaches hashing

    def release(self, name: str, version: str, **extra: Any) -> dict:
        """A registry release shaped like what this ecosystem's watcher writes."""
        if self.name == "javascript":
            return {
                "name": name,
                "version": version,
                "npm_package": f"@opentelemetry/{name}",
                "description": f"Instrumentation for {name}",
                "repository": "open-telemetry/opentelemetry-js-contrib",
                **extra,
            }
        return {
            "name": name,
            "version": version,
            "description": f"Instrumentation for {name}",
            "repository": "open-telemetry/opentelemetry-python-contrib",
            "requires_python": ">=3.10",
            **extra,
        }


ECOSYSTEMS = [
    Ecosystem(
        "javascript",
        run_javascript_builder,
        JsInventoryManager,
        JavascriptDatabaseWriter,
        "instrumentation-express",
        "instrumentation-pg",
        ("0.9.0", "0.10.0"),
        "latest",
        "node_engine",
    ),
    Ecosystem(
        "python",
        run_python_builder,
        PythonInventoryManager,
        PythonDatabaseWriter,
        "opentelemetry-instrumentation-flask",
        "opentelemetry-instrumentation-pg",
        ("0.66b0", "0.66b1"),
        "latest",
        "requires_python",
    ),
]


@pytest.fixture(params=ECOSYSTEMS, ids=lambda e: e.name)
def eco(request) -> Ecosystem:
    return request.param


@pytest.fixture
def registry(eco, tmp_path):
    """A small registry written through the ecosystem's own InventoryManager."""
    manager = eco.manager(registry_dir=str(tmp_path / "registry"))
    # Two releases of one package that differ only in version, like most of the real registries.
    for version in eco.versions:
        manager.save(eco.pkg, version, eco.release(eco.pkg, version))
    return manager


@pytest.fixture
def writer(eco, tmp_path):
    return eco.writer(str(tmp_path / eco.name))


def _index(writer):
    return json.loads((writer.database_dir / "index.json").read_text())


def _files(writer):
    return {p: p.read_bytes() for p in writer.database_dir.rglob("*.json")}


def test_success_writes_only_index_and_packages(eco, registry, writer):
    assert eco.run(inventory_manager=registry, db_writer=writer) == 0

    assert sorted(p.name for p in writer.database_dir.iterdir()) == ["index.json", "packages"]
    assert _index(writer)["ecosystem"] == eco.name


def test_releases_differing_only_in_version_share_one_file(eco, registry, writer):
    eco.run(inventory_manager=registry, db_writer=writer)

    entry = _index(writer)["packages"][0]
    assert len({r["hash"] for r in entry["releases"]}) == 1
    assert len(list((writer.database_dir / "packages" / eco.pkg).iterdir())) == 1


def test_rebuild_is_byte_identical(eco, registry, writer):
    eco.run(inventory_manager=registry, db_writer=writer)
    first = _files(writer)

    eco.run(inventory_manager=registry, db_writer=writer)

    assert _files(writer) == first


def test_clean_build_in_a_new_directory_matches(eco, registry, writer, tmp_path):
    eco.run(inventory_manager=registry, db_writer=writer)
    other = eco.writer(str(tmp_path / "elsewhere"))

    eco.run(inventory_manager=registry, db_writer=other, clean=True)

    def relative(db):
        return {p.relative_to(db.database_dir): b for p, b in _files(db).items()}

    assert relative(writer) == relative(other)


def test_returns_1_when_registry_empty_and_writes_no_index(eco, tmp_path, writer):
    empty = eco.manager(registry_dir=str(tmp_path / "empty"))

    assert eco.run(inventory_manager=empty, db_writer=writer) == 1
    assert not (writer.database_dir / "index.json").exists()


def test_returns_1_on_name_mismatch(eco, registry, writer):
    version = eco.versions[0]
    registry.save(eco.other_pkg, version, eco.release("some-other-name", version))

    assert eco.run(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_when_the_version_field_does_not_match_the_file(eco, registry, writer):
    registry.save(eco.other_pkg, eco.versions[1], eco.release(eco.other_pkg, eco.versions[0]))

    assert eco.run(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unparseable_version(eco, registry, writer):
    registry.save(eco.other_pkg, eco.bad_version, eco.release(eco.other_pkg, eco.bad_version))

    assert eco.run(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_non_mapping_registry_file(eco, registry, writer):
    path = registry.registry_dir / eco.other_pkg / f"v{eco.versions[0]}.yaml"
    path.parent.mkdir()
    path.write_text("- a\n- list\n")

    assert eco.run(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unhashable_value(eco, registry, writer):
    # An unquoted date in YAML loads as datetime.date, which isn't JSON, so
    # hashing raises TypeError. That must fail the build, not crash it.
    path = registry.registry_dir / eco.other_pkg / f"v{eco.versions[0]}.yaml"
    path.parent.mkdir()
    path.write_text(f"name: {eco.other_pkg}\nversion: '{eco.versions[0]}'\n{eco.published_field}: 2026-09-30\n")

    assert eco.run(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_write_failure(eco, registry):
    failing = MagicMock()
    failing.write_package.side_effect = OSError("disk full")

    assert eco.run(inventory_manager=registry, db_writer=failing) == 1


def test_removes_orphans_when_incremental(eco, registry, writer):
    eco.run(inventory_manager=registry, db_writer=writer)
    stale = writer.database_dir / "packages" / eco.pkg / f"{eco.pkg}-000000000000.json"
    stale.write_text("{}")

    eco.run(inventory_manager=registry, db_writer=writer)

    assert not stale.exists()


def test_a_changed_release_orphans_its_old_file_once_nothing_references_it(eco, registry, writer):
    eco.run(inventory_manager=registry, db_writer=writer)
    old_hash = _index(writer)["packages"][0]["releases"][0]["hash"]
    old_file = writer.database_dir / "packages" / eco.pkg / f"{eco.pkg}-{old_hash}.json"
    # Every release changes, as when a published field is added.
    for version in eco.versions:
        registry.save(eco.pkg, version, eco.release(eco.pkg, version, description="reworded"))

    eco.run(inventory_manager=registry, db_writer=writer)

    assert not old_file.exists()
    assert len(list((writer.database_dir / "packages" / eco.pkg).iterdir())) == 1


def test_clean_wipes_before_building(eco, registry, writer):
    writer.database_dir.mkdir(parents=True)
    leftover = writer.database_dir / "leftover.json"
    leftover.write_text("{}")

    assert eco.run(inventory_manager=registry, db_writer=writer, clean=True) == 0

    assert not leftover.exists()
    assert (writer.database_dir / "index.json").exists()


def test_skips_orphan_gc_when_clean(eco, registry):
    mock_writer = MagicMock()
    mock_writer.write_package.return_value = "abc123def456"
    mock_writer.get_stats.return_value = {"files_written": 0, "total_bytes": 0}

    eco.run(inventory_manager=registry, db_writer=mock_writer, clean=True)

    mock_writer.clean.assert_called_once()
    mock_writer.remove_orphans.assert_not_called()
