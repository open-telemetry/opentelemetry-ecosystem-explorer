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
"""Tests for python_builder module."""

import json
from unittest.mock import MagicMock

import pytest
from explorer_db_builder.python_builder import (
    PACKAGE_FIELDS,
    make_index_package,
    make_package,
    run_python_builder,
    sort_versions,
)
from explorer_db_builder.python_database_writer import PythonDatabaseWriter
from python_instrumentation_watcher.inventory_manager import InventoryManager

FLASK = "opentelemetry-instrumentation-flask"
CLICK = "opentelemetry-instrumentation-click"


def _release(name: str, version: str, **extra) -> dict:
    """A registry release shaped like what the Python watcher writes."""
    short = name.removeprefix("opentelemetry-instrumentation-")
    return {
        "name": name,
        "version": version,
        "description": f"{short} instrumentation for OpenTelemetry",
        "repository": "open-telemetry/opentelemetry-python-contrib",
        "source_path": f"instrumentation/{name}",
        "homepage": f"https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/{name}",
        "requires_python": ">=3.10",
        "entry_points": [{"name": short, "value": f"opentelemetry.instrumentation.{short}:Instrumentor"}],
        "instruments": [{"library": short, "source_key": "instruments", "version_range": ">= 1.0"}],
        "supports_metrics": True,
        "semantic_convention_status": "migration",
        **extra,
    }


@pytest.fixture
def registry(tmp_path):
    """A small registry written through the watcher's own InventoryManager."""
    manager = InventoryManager(registry_dir=str(tmp_path / "registry"))
    # Three flask releases that differ only in version, like the real registry.
    for version in ("0.66b0", "0.66b1", "0.66b2"):
        manager.save(FLASK, version, _release(FLASK, version))
    manager.save(
        CLICK,
        "0.66b2",
        _release(CLICK, "0.66b2", supports_metrics=None, semantic_convention_status=None),
    )
    return manager


@pytest.fixture
def writer(tmp_path):
    return PythonDatabaseWriter(str(tmp_path / "python"))


def _read(path):
    return json.loads(path.read_text())


def _index(writer):
    return _read(writer.database_dir / "index.json")


def _index_entry(writer, name):
    return next(p for p in _index(writer)["packages"] if p["name"] == name)


def _package_for(writer, name, version):
    """Follow index.json to the package file a release uses."""
    entry = _index_entry(writer, name)
    package_hash = next(r["hash"] for r in entry["releases"] if r["version"] == version)
    return _read(writer.database_dir / "packages" / name / f"{name}-{package_hash}.json")


# --- output structure -------------------------------------------------------------------------


def test_success_writes_only_index_and_packages(registry, writer):
    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 0

    assert sorted(p.name for p in writer.database_dir.iterdir()) == ["index.json", "packages"]


def test_index_structure(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    index = _index(writer)
    assert index["ecosystem"] == "python"
    assert [p["name"] for p in index["packages"]] == [CLICK, FLASK]


def test_index_entry_shape(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    entry = _index_entry(writer, FLASK)
    assert set(entry) == {
        "name",
        "description",
        "supports_metrics",
        "semantic_convention_status",
        "version",
        "releases",
    }
    assert entry["version"] == "0.66b2"
    assert entry["supports_metrics"] is True
    assert entry["semantic_convention_status"] == "migration"
    assert all(set(r) == {"version", "hash"} for r in entry["releases"])


def test_package_file_keeps_published_fields(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    package = _package_for(writer, FLASK, "0.66b2")
    assert set(package) == set(PACKAGE_FIELDS)
    assert package["requires_python"] == ">=3.10"
    assert package["instruments"] == [{"library": "flask", "source_key": "instruments", "version_range": ">= 1.0"}]
    assert package["entry_points"][0]["value"] == "opentelemetry.instrumentation.flask:Instrumentor"


def test_package_file_drops_unpublished_fields(registry, writer):
    registry.save(
        "opentelemetry-instrumentation-pg",
        "0.66b2",
        _release("opentelemetry-instrumentation-pg", "0.66b2", component_owners=["someone"], unknown_future_field=1),
    )

    run_python_builder(inventory_manager=registry, db_writer=writer)

    package = _package_for(writer, "opentelemetry-instrumentation-pg", "0.66b2")
    assert "version" not in package
    assert "component_owners" not in package
    assert "unknown_future_field" not in package


def test_make_package_omits_absent_fields_instead_of_inventing_them():
    assert make_package({"name": FLASK, "version": "0.66b2"}) == {"name": FLASK}


# --- identical releases and hashing -----------------------------------------------------------


def test_releases_differing_only_in_version_share_one_file(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    flask = _index_entry(writer, FLASK)
    assert len({r["hash"] for r in flask["releases"]}) == 1
    assert len(list((writer.database_dir / "packages" / FLASK).iterdir())) == 1


def test_releases_with_different_metadata_get_separate_files(registry, writer):
    registry.save(FLASK, "0.67b0", _release(FLASK, "0.67b0", requires_python=">=3.11"))

    run_python_builder(inventory_manager=registry, db_writer=writer)

    assert _package_for(writer, FLASK, "0.67b0")["requires_python"] == ">=3.11"
    assert _package_for(writer, FLASK, "0.66b2")["requires_python"] == ">=3.10"
    assert len(list((writer.database_dir / "packages" / FLASK).iterdir())) == 2


def test_index_metadata_comes_from_newest_release(registry, writer):
    registry.save(FLASK, "0.67b0", _release(FLASK, "0.67b0", description="Newest description"))

    run_python_builder(inventory_manager=registry, db_writer=writer)

    assert _index_entry(writer, FLASK)["description"] == "Newest description"


def test_hash_does_not_depend_on_registry_key_order(registry, writer, tmp_path):
    reordered = InventoryManager(registry_dir=str(tmp_path / "reordered"))
    release = _release(FLASK, "0.66b2")
    reordered.save(FLASK, "0.66b2", dict(reversed(list(release.items()))))
    other_writer = PythonDatabaseWriter(str(tmp_path / "python-other"))

    run_python_builder(inventory_manager=registry, db_writer=writer)
    run_python_builder(inventory_manager=reordered, db_writer=other_writer)

    expected = _index_entry(writer, FLASK)["releases"][0]["hash"]
    assert _index_entry(other_writer, FLASK)["releases"][0]["hash"] == expected


def test_rebuild_is_byte_identical(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)
    first = {p: p.read_bytes() for p in writer.database_dir.rglob("*.json")}

    run_python_builder(inventory_manager=registry, db_writer=writer)
    second = {p: p.read_bytes() for p in writer.database_dir.rglob("*.json")}

    assert first == second


def test_fresh_build_and_rebuild_in_a_new_directory_match(registry, writer, tmp_path):
    run_python_builder(inventory_manager=registry, db_writer=writer)
    other = PythonDatabaseWriter(str(tmp_path / "elsewhere"))

    run_python_builder(inventory_manager=registry, db_writer=other, clean=True)

    def relative(db):
        return {p.relative_to(db.database_dir): p.read_bytes() for p in db.database_dir.rglob("*.json")}

    assert relative(writer) == relative(other)


# --- null versus false ------------------------------------------------------------------------


def test_null_metadata_stays_null_in_package_and_index(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    package = _package_for(writer, CLICK, "0.66b2")
    assert package["supports_metrics"] is None
    assert package["semantic_convention_status"] is None
    entry = _index_entry(writer, CLICK)
    assert entry["supports_metrics"] is None
    assert entry["semantic_convention_status"] is None


def test_false_metrics_stays_false(registry, writer):
    registry.save(
        "opentelemetry-instrumentation-pg",
        "0.66b2",
        _release("opentelemetry-instrumentation-pg", "0.66b2", supports_metrics=False),
    )

    run_python_builder(inventory_manager=registry, db_writer=writer)

    pg = "opentelemetry-instrumentation-pg"
    assert _package_for(writer, pg, "0.66b2")["supports_metrics"] is False
    assert _index_entry(writer, pg)["supports_metrics"] is False


def test_null_and_false_produce_different_package_files(registry, writer):
    registry.save(FLASK, "0.67b0", _release(FLASK, "0.67b0", supports_metrics=None))
    registry.save(FLASK, "0.67b1", _release(FLASK, "0.67b1", supports_metrics=False))

    run_python_builder(inventory_manager=registry, db_writer=writer)

    hashes = {r["version"]: r["hash"] for r in _index_entry(writer, FLASK)["releases"]}
    assert len({hashes["0.66b2"], hashes["0.67b0"], hashes["0.67b1"]}) == 3


def test_index_writes_null_not_false_when_a_release_lacks_the_fields():
    package = {"name": FLASK, "description": "d"}

    entry = make_index_package(package, [{"version": "0.66b2", "hash": "abc"}])

    assert entry["supports_metrics"] is None
    assert entry["semantic_convention_status"] is None


# --- version ordering -------------------------------------------------------------------------


def test_index_lists_releases_newest_first_by_pep440(registry, writer):
    # As text, 0.9b0 sorts above 0.66b2 and 0.10b0.
    for version in ("0.9b0", "0.10b0"):
        registry.save(FLASK, version, _release(FLASK, version))

    run_python_builder(inventory_manager=registry, db_writer=writer)

    entry = _index_entry(writer, FLASK)
    assert [r["version"] for r in entry["releases"]] == ["0.66b2", "0.66b1", "0.66b0", "0.10b0", "0.9b0"]
    assert entry["version"] == "0.66b2"


def test_sort_versions_orders_prereleases_and_finals():
    versions = ["0.66a1", "0.66b2", "0.66", "0.66rc1", "0.66b10", "0.66.dev1", "0.67b0", "1.0"]

    assert sort_versions(FLASK, versions) == [
        "1.0",
        "0.67b0",
        "0.66",
        "0.66rc1",
        "0.66b10",
        "0.66b2",
        "0.66a1",
        "0.66.dev1",
    ]


def test_sort_versions_returns_the_registry_strings_unchanged():
    # The strings are file names, so a normalized spelling would not load.
    assert sort_versions(FLASK, ["0.66b1", "0.66.0b2"]) == ["0.66.0b2", "0.66b1"]


def test_sort_versions_accepts_the_alternative_spellings_pep440_normalizes():
    # 1.0.0-beta.1 is not what python-contrib publishes, but PEP 440 reads it as 1.0.0b1.
    assert sort_versions(FLASK, ["1.0.0a1", "1.0.0-beta.1"]) == ["1.0.0-beta.1", "1.0.0a1"]


def test_sort_versions_rejects_a_non_pep440_version():
    with pytest.raises(ValueError, match="not a PEP 440 version"):
        sort_versions(FLASK, ["0.66b2", "latest"])


def test_sort_versions_rejects_two_spellings_of_one_version():
    with pytest.raises(ValueError, match="same version"):
        sort_versions(FLASK, ["0.66b2", "0.66.0b2"])


def test_latest_release_is_a_prerelease_when_there_is_nothing_else(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)

    assert _index_entry(writer, CLICK)["version"] == "0.66b2"


# --- errors -----------------------------------------------------------------------------------


def test_returns_1_when_registry_empty(tmp_path, writer):
    empty = InventoryManager(registry_dir=str(tmp_path / "empty"))

    assert run_python_builder(inventory_manager=empty, db_writer=writer) == 1


def test_returns_1_and_writes_no_index_when_registry_empty(tmp_path, writer):
    empty = InventoryManager(registry_dir=str(tmp_path / "empty"))

    run_python_builder(inventory_manager=empty, db_writer=writer)

    assert not (writer.database_dir / "index.json").exists()


def test_returns_1_on_name_mismatch(registry, writer):
    registry.save(
        "opentelemetry-instrumentation-pg", "0.66b2", _release("opentelemetry-instrumentation-mysql", "0.66b2")
    )

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_version_field_not_matching_file(registry, writer):
    registry.save("opentelemetry-instrumentation-pg", "0.66b2", _release("opentelemetry-instrumentation-pg", "0.66b1"))

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unparseable_version(registry, writer):
    pg = "opentelemetry-instrumentation-pg"
    registry.save(pg, "latest", _release(pg, "latest"))

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_a_version_neither_pep440_nor_normalizable(registry, writer):
    pg = "opentelemetry-instrumentation-pg"
    registry.save(pg, "1.0.0-beta.x", _release(pg, "1.0.0-beta.x"))

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_non_mapping_registry_file(registry, writer):
    path = registry.registry_dir / "opentelemetry-instrumentation-pg" / "v0.66b2.yaml"
    path.parent.mkdir()
    path.write_text("- a\n- list\n")

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_unhashable_value(registry, writer):
    # An unquoted date in YAML loads as datetime.date, which isn't JSON, so
    # hashing raises TypeError. That must fail the build, not crash it.
    path = registry.registry_dir / "opentelemetry-instrumentation-pg" / "v0.66b2.yaml"
    path.parent.mkdir()
    path.write_text(
        "name: opentelemetry-instrumentation-pg\nversion: 0.66b2\nrequires_python: 2026-09-30\n",
    )

    assert run_python_builder(inventory_manager=registry, db_writer=writer) == 1


def test_returns_1_on_write_failure(registry):
    failing = MagicMock()
    failing.write_package.side_effect = OSError("disk full")

    assert run_python_builder(inventory_manager=registry, db_writer=failing) == 1


# --- cleanup ----------------------------------------------------------------------------------


def test_removes_orphans_when_incremental(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)
    stale = writer.database_dir / "packages" / FLASK / f"{FLASK}-000000000000.json"
    stale.write_text("{}")

    run_python_builder(inventory_manager=registry, db_writer=writer)

    assert not stale.exists()


def test_changed_metadata_orphans_the_old_file_only_once_it_is_unreferenced(registry, writer):
    run_python_builder(inventory_manager=registry, db_writer=writer)
    old_hash = _index_entry(writer, FLASK)["releases"][0]["hash"]
    old_file = writer.database_dir / "packages" / FLASK / f"{FLASK}-{old_hash}.json"
    # Every release changes, as when a published field is added to PACKAGE_FIELDS.
    for version in ("0.66b0", "0.66b1", "0.66b2"):
        registry.save(FLASK, version, _release(FLASK, version, requires_python=">=3.11"))

    run_python_builder(inventory_manager=registry, db_writer=writer)

    assert not old_file.exists()
    assert len(list((writer.database_dir / "packages" / FLASK).iterdir())) == 1


def test_clean_wipes_before_building(registry, writer):
    writer.database_dir.mkdir(parents=True)
    leftover = writer.database_dir / "leftover.json"
    leftover.write_text("{}")

    assert run_python_builder(inventory_manager=registry, db_writer=writer, clean=True) == 0

    assert not leftover.exists()
    assert (writer.database_dir / "index.json").exists()


def test_skips_orphan_gc_when_clean(registry):
    mock_writer = MagicMock()
    mock_writer.write_package.return_value = "abc123def456"
    mock_writer.get_stats.return_value = {"files_written": 0, "total_bytes": 0}

    run_python_builder(inventory_manager=registry, db_writer=mock_writer, clean=True)

    mock_writer.clean.assert_called_once()
    mock_writer.remove_orphans.assert_not_called()
