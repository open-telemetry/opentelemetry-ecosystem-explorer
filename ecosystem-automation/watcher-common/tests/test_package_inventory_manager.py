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

"""Tests for PackageInventoryManager, the per-package-version registry reader shared by JS and Python."""

import pytest
import yaml
from watcher_common.inventory_manager import PackageInventoryManager


def _write(registry, package: str, version: str, data) -> None:
    path = registry / package / f"v{version}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data))


def test_version_exists(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    _write(tmp_path, "pkg-a", "0.66b2", {"name": "pkg-a"})

    assert manager.version_exists("pkg-a", "0.66b2")
    assert not manager.version_exists("pkg-a", "0.66b3")
    assert not manager.version_exists("pkg-b", "0.66b2")


def test_list_packages_sorted_and_only_with_versions(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    _write(tmp_path, "pkg-b", "1.0.0", {"name": "pkg-b"})
    _write(tmp_path, "pkg-a", "1.0.0", {"name": "pkg-a"})
    # A directory with no version files and a stray file at the top level are not packages.
    (tmp_path / "pkg-empty").mkdir()
    (tmp_path / "README.md").write_text("notes")

    assert manager.list_packages() == ["pkg-a", "pkg-b"]


def test_list_packages_empty_when_registry_missing(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path / "does-not-exist"))

    assert manager.list_packages() == []


@pytest.mark.parametrize("versions", [["0.9.0", "0.10.0"], ["0.9b0", "0.66b2"]])
def test_list_versions_strips_prefix_and_ignores_other_files(tmp_path, versions):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    for version in versions:
        _write(tmp_path, "pkg-a", version, {"name": "pkg-a"})
    (tmp_path / "pkg-a" / "notes.txt").write_text("not a version")

    assert sorted(manager.list_versions("pkg-a")) == sorted(versions)


def test_list_versions_is_empty_for_a_missing_package(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))

    assert manager.list_versions("pkg-a") == []


def test_list_versions_ignores_an_abandoned_atomic_write_temp_file(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    _write(tmp_path, "pkg-a", "0.66b2", {"name": "pkg-a"})
    # The shape atomic_write leaves behind if a run is killed mid-write.
    (tmp_path / "pkg-a" / ".v0.66b3.yaml.abc123.tmp").write_text("partial")

    assert manager.list_versions("pkg-a") == ["0.66b2"]


def test_load_returns_the_file_content_including_null_and_false(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    data = {"name": "pkg-a", "version": "0.66b2", "supports_metrics": False, "semantic_convention_status": None}
    _write(tmp_path, "pkg-a", "0.66b2", data)

    loaded = manager.load("pkg-a", "0.66b2")

    assert loaded == data
    assert loaded["supports_metrics"] is False
    assert loaded["semantic_convention_status"] is None


def test_load_rejects_non_mapping_file(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))
    _write(tmp_path, "pkg-a", "0.66b2", ["just", "a", "list"])

    with pytest.raises(ValueError, match="does not contain a mapping"):
        manager.load("pkg-a", "0.66b2")


def test_load_missing_version_raises(tmp_path):
    manager = PackageInventoryManager(registry_dir=str(tmp_path))

    with pytest.raises(FileNotFoundError):
        manager.load("pkg-a", "0.66b2")
