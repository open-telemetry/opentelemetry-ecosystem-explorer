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
"""Safety and publication contracts for shared README stores."""

from pathlib import Path
from unittest.mock import patch

import pytest
from semantic_version import Version
from watcher_common.inventory_manager import JavaagentInventoryManager
from watcher_common.readme_store import (
    ReadmeStore,
    parse_readme_filename,
    read_readme_index,
    readme_filename,
    write_readme_index,
)


@pytest.mark.parametrize(
    "filename",
    [
        "foo-abc.md",
        "-abc123def456.md",
        "foo.md",
        "/foo-abc123def456.md",
        "../foo-abc123def456.md",
        "foo\\bar-abc123def456.md",
    ],
)
def test_invalid_filenames(filename):
    assert parse_readme_filename(filename) is None


def test_parse_filename():
    assert parse_readme_filename("my-lib-1.0-abc123def456.md") == ("my-lib-1.0", "abc123def456")


@pytest.mark.parametrize(
    "document",
    [
        "",
        "null",
        "[]",
        "hello",
        "1: foo",
        "foo: 1",
        "foo: []",
        "foo: foo-abc123def456.md\nfoo: foo-abc123def456.md",
        "foo: other-abc123def456.md",
        "foo: /foo-abc123def456.md",
        "foo: ../foo-abc123def456.md",
        'foo: "foo\\\\bar-abc123def456.md"',
        "foo: [",
    ],
)
def test_invalid_indexes_abort_prune_after_valid_index(tmp_path, document):
    manager = JavaagentInventoryManager(str(tmp_path))
    manager.save_library_readmes(Version("3.0.0"), [("retained", "content")])
    orphan = tmp_path / "library_readmes" / readme_filename("orphan", "unused")
    orphan.write_text("unused")
    invalid = manager.get_version_dir(Version("1.0.0")) / manager.README_INDEX_FILE
    invalid.parent.mkdir()
    invalid.write_text(document)
    before = {p: p.read_bytes() for p in orphan.parent.iterdir()}
    with pytest.raises(ValueError):
        manager.prune_orphan_readmes()
    with pytest.raises(ValueError):
        manager.readme_index_exists(Version("1.0.0"))
    assert before == {p: p.read_bytes() for p in orphan.parent.iterdir()}


def test_missing_empty_and_deterministic_indexes(tmp_path):
    path = tmp_path / "index.yaml"
    assert read_readme_index(path) == {}
    write_readme_index(path, {})
    assert path.read_text() == "{}\n"
    index = {name: readme_filename(name, name) for name in ["z", "a"]}
    write_readme_index(path, index)
    original = path.read_bytes()
    write_readme_index(path, dict(reversed(list(index.items()))))
    assert path.read_bytes() == original
    assert list(read_readme_index(path)) == ["a", "z"]


def test_unreadable_index_does_not_prune(tmp_path):
    manager = JavaagentInventoryManager(str(tmp_path))
    manager.save_library_readmes(Version("1.0.0"), [("lib", "text")])
    with patch.object(Path, "read_text", side_effect=PermissionError("unreadable")):
        with pytest.raises(PermissionError):
            manager.prune_orphan_readmes()
        with pytest.raises(PermissionError):
            manager.readme_index_exists(Version("1.0.0"))
    assert len(list((tmp_path / "library_readmes").glob("*.md"))) == 1


@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("stage", ["store", "index"])
@pytest.mark.parametrize("failure", ["flush", "replace"])
def test_atomic_publication_failure(tmp_path, existing, stage, failure):
    manager = JavaagentInventoryManager(str(tmp_path))
    version = Version("1.0.0")
    index_path = manager.get_version_dir(version) / manager.README_INDEX_FILE
    if existing:
        manager.save_library_readmes(version, [("lib", "old")])
    original = index_path.read_bytes() if existing else None
    if stage == "index":
        ReadmeStore(tmp_path / "library_readmes").save([("lib", "new")])
    target = "watcher_common.readme_store.os." + ("fsync" if failure == "flush" else "replace")
    with patch(target, side_effect=OSError("disk failure")):
        with pytest.raises(OSError):
            manager.save_library_readmes(version, [("lib", "new")])
    assert (index_path.read_bytes() if index_path.exists() else None) == original
    assert not list(tmp_path.rglob(".readme-*"))
    if stage == "store":
        assert not (tmp_path / "library_readmes" / readme_filename("lib", "new")).exists()


def test_conflicting_existing_bytes_are_rejected(tmp_path):
    store = ReadmeStore(tmp_path)
    store.save([("lib", "original")])
    path = tmp_path / readme_filename("lib", "original")
    path.write_text("corrupt")
    with pytest.raises(ValueError, match="Conflicting"):
        store.save([("lib", "original")])
    assert path.read_text() == "corrupt"


def test_java_dedup_raw_names_and_pruning(tmp_path):
    manager = JavaagentInventoryManager(str(tmp_path))
    first, second = Version("1.0.0"), Version("2.0.0")
    assert manager.save_library_readmes(first, [("../lib", "content")]) == 1
    assert manager.save_library_readmes(second, [("../lib", "content")]) == 0
    digest = manager.load_library_readme_map(first)["../lib"]
    assert manager.load_library_readme_content("../lib", digest) == "content"
    manager.delete_version(first)
    assert manager.prune_orphan_readmes() == 0
    manager.save_library_readmes(second, [])
    manager.get_version_dir(Version("3.0.0")).mkdir()  # Missing index is allowed.
    assert manager.prune_orphan_readmes() == 1
    assert manager.readme_index_exists(second)


def test_duplicate_name_with_different_content_is_rejected(tmp_path):
    with pytest.raises(ValueError, match="Multiple"):
        ReadmeStore(tmp_path).save([("lib", "first"), ("lib", "second")])
    assert not list(tmp_path.iterdir())


def test_unreadable_blob_remains_a_best_effort_read(tmp_path):
    store = ReadmeStore(tmp_path)
    index, _ = store.save([("lib", "content")])
    with patch.object(Path, "read_bytes", side_effect=PermissionError("unreadable")):
        assert store.read(index["lib"]) is None
