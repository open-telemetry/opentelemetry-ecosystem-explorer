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
"""Tests for JavascriptDatabaseWriter."""

import json
from pathlib import Path

import pytest
from explorer_db_builder.javascript_database_writer import JavascriptDatabaseWriter


def _package(**extra) -> dict:
    return {"name": "instrumentation-express", "description": "Express instrumentation", **extra}


def _write_index(writer, name: str, *hashes: str) -> None:
    releases = [{"version": f"0.{i}.0", "hash": h} for i, h in enumerate(hashes)]
    writer.write_index([{"name": name, "releases": releases}])


def test_write_package_is_content_addressed(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))

    package_hash = writer.write_package(_package())

    path = tmp_path / "packages" / "instrumentation-express" / f"instrumentation-express-{package_hash}.json"
    assert json.loads(path.read_text()) == _package()


def test_write_package_skips_existing_file(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))

    first = writer.write_package(_package())
    second = writer.write_package(_package())

    assert first == second
    assert writer.get_stats()["files_written"] == 1


def test_write_package_different_content_gets_different_file(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))

    old = writer.write_package(_package(node_engine=">=14"))
    new = writer.write_package(_package(node_engine=">=18"))

    assert old != new
    assert len(list((tmp_path / "packages" / "instrumentation-express").glob("*.json"))) == 2


def test_write_package_requires_name(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))

    with pytest.raises(ValueError, match="missing a 'name'"):
        writer.write_package({"description": "no name"})


def test_package_name_is_sanitized_in_paths(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))

    package_hash = writer.write_package({"name": "../escape"})

    assert (tmp_path / "packages" / ".._escape" / f".._escape-{package_hash}.json").exists()
    assert not (tmp_path.parent / "escape").exists()


def test_write_index(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path / "javascript"))
    entries = [{"name": "instrumentation-express", "version": "0.70.0"}]

    writer.write_index(entries)

    data = json.loads((tmp_path / "javascript" / "index.json").read_text())
    assert data == {"ecosystem": "javascript", "packages": entries}


def test_remove_orphans_keeps_referenced_and_removes_unreferenced(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    live = writer.write_package(_package())
    # Written but not in index.json, e.g. left behind after the published
    # fields changed.
    stale = writer.write_package(_package(description="old shape"))
    _write_index(writer, "instrumentation-express", live)

    removed = writer.remove_orphans()

    package_dir = tmp_path / "packages" / "instrumentation-express"
    assert removed == 1
    assert (package_dir / f"instrumentation-express-{live}.json").exists()
    assert not (package_dir / f"instrumentation-express-{stale}.json").exists()


def test_remove_orphans_keeps_file_shared_by_several_releases(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    shared = writer.write_package(_package())
    _write_index(writer, "instrumentation-express", shared, shared, shared)

    assert writer.remove_orphans() == 0
    assert len(list((tmp_path / "packages").glob("*/*.json"))) == 1


def test_remove_orphans_drops_emptied_package_directory(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    # A package that dropped out of the registry entirely.
    writer.write_package({"name": "instrumentation-removed"})
    live = writer.write_package(_package())
    _write_index(writer, "instrumentation-express", live)

    writer.remove_orphans()

    assert not (tmp_path / "packages" / "instrumentation-removed").exists()


def test_remove_orphans_skips_without_index(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    package_hash = writer.write_package(_package())

    # No index.json means nothing is known to be live, so nothing is deleted.
    assert writer.remove_orphans() == 0
    assert (tmp_path / "packages" / "instrumentation-express" / f"instrumentation-express-{package_hash}.json").exists()


def test_remove_orphans_with_no_packages_directory(tmp_path):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    writer.write_index([])

    assert writer.remove_orphans() == 0


def test_remove_orphans_keeps_going_when_a_delete_fails(tmp_path, monkeypatch):
    writer = JavascriptDatabaseWriter(str(tmp_path))
    live = writer.write_package(_package())
    writer.write_package(_package(description="stale one"))
    writer.write_package(_package(description="stale two"))
    _write_index(writer, "instrumentation-express", live)

    real_unlink = Path.unlink
    calls = []

    def flaky_unlink(self, *args, **kwargs):
        calls.append(self)
        if len(calls) == 1:
            raise OSError("permission denied")
        return real_unlink(self, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", flaky_unlink)

    # The first delete fails and is logged; the second still happens.
    assert writer.remove_orphans() == 1
    assert len(list((tmp_path / "packages").glob("*/*.json"))) == 2


def test_clean_removes_everything(tmp_path):
    database_dir = tmp_path / "javascript"
    writer = JavascriptDatabaseWriter(str(database_dir))
    writer.write_package(_package())
    (database_dir / "hand-written.json").write_text("{}")

    writer.clean()

    assert database_dir.is_dir()
    assert list(database_dir.iterdir()) == []
