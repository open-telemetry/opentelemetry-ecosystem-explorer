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
"""Tests for the archive plan the nightly workflow consumes."""

import json

from explorer_db_builder.archive_plan import PLAN_FILENAME, emit_archives
from explorer_db_builder.archive_writer import release_tag, tree_digest
from explorer_db_builder.data_manifest import update_entry, write_manifest

ECOSYSTEM_NAMES = ("collector", "configuration", "javaagent")


def build_data_root(root):
    for ecosystem in ECOSYSTEM_NAMES:
        directory = root / ecosystem
        directory.mkdir(parents=True)
        (directory / f"{ecosystem}.json").write_text(ecosystem)
    return root


def test_emit_archives_writes_one_archive_and_a_plan_entry_per_ecosystem(tmp_path):
    data_root = build_data_root(tmp_path / "data")
    output = tmp_path / "archives"

    exit_code = emit_archives(output, data_root=data_root, manifest_path=tmp_path / "absent.json")

    assert exit_code == 0
    plan = json.loads((output / PLAN_FILENAME).read_text())
    assert sorted(plan) == list(ECOSYSTEM_NAMES)
    for ecosystem, entry in plan.items():
        assert (output / f"{ecosystem}.tar.gz").is_file()
        assert entry["asset"] == f"{ecosystem}.tar.gz"
        assert entry["release_tag"] == release_tag(ecosystem, entry["content_digest"])
        assert entry["changed"] is True
        assert "archive" not in entry


def test_emit_archives_marks_matching_content_unchanged(tmp_path):
    data_root = build_data_root(tmp_path / "data")
    digest = tree_digest(data_root / "collector")
    manifest_path = tmp_path / "data-manifest.json"
    write_manifest(
        manifest_path,
        update_entry(
            {"ecosystems": {}},
            ecosystem="collector",
            release_tag=release_tag("collector", digest),
            content_digest=digest,
            archive_sha256="b" * 64,
            registry_commit="c" * 40,
        ),
    )
    output = tmp_path / "archives"

    emit_archives(output, data_root=data_root, manifest_path=manifest_path)

    plan = json.loads((output / PLAN_FILENAME).read_text())
    assert plan["collector"]["changed"] is False
    assert plan["javaagent"]["changed"] is True


def test_emit_archives_reports_every_missing_ecosystem_and_writes_nothing(tmp_path):
    data_root = tmp_path / "data"
    (data_root / "collector").mkdir(parents=True)
    output = tmp_path / "archives"

    exit_code = emit_archives(output, data_root=data_root, manifest_path=tmp_path / "absent.json")

    assert exit_code == 1
    # Validation happens before any packing, so no partial output is left behind.
    assert not (output / "collector.tar.gz").exists()
    assert not (output / PLAN_FILENAME).exists()


def test_emit_archives_is_deterministic(tmp_path):
    data_root = build_data_root(tmp_path / "data")

    emit_archives(tmp_path / "first", data_root=data_root, manifest_path=tmp_path / "absent.json")
    emit_archives(tmp_path / "second", data_root=data_root, manifest_path=tmp_path / "absent.json")

    for ecosystem in ECOSYSTEM_NAMES:
        first = (tmp_path / "first" / f"{ecosystem}.tar.gz").read_bytes()
        second = (tmp_path / "second" / f"{ecosystem}.tar.gz").read_bytes()
        assert first == second


def test_emit_archives_refuses_an_empty_ecosystem_directory(tmp_path):
    # An empty directory packs into a valid 45-byte archive under a legitimate-looking tag;
    # promoting it would replace the live data with nothing.
    data_root = build_data_root(tmp_path / "data")
    for path in (data_root / "configuration").iterdir():
        path.unlink()
    output = tmp_path / "archives"

    exit_code = emit_archives(output, data_root=data_root, manifest_path=tmp_path / "absent.json")

    assert exit_code == 1
    assert not (output / PLAN_FILENAME).exists()


def test_emit_archives_removes_a_stale_plan_from_a_failed_run(tmp_path):
    data_root = build_data_root(tmp_path / "data")
    output = tmp_path / "archives"
    output.mkdir()
    (output / PLAN_FILENAME).write_text('{"javaagent": {"content_digest": "stale"}}')
    (data_root / "configuration" / "configuration.json").unlink()

    exit_code = emit_archives(output, data_root=data_root, manifest_path=tmp_path / "absent.json")

    assert exit_code == 1
    assert not (output / PLAN_FILENAME).exists()


def test_emit_archives_reports_a_malformed_manifest_without_a_traceback(tmp_path):
    data_root = build_data_root(tmp_path / "data")
    manifest_path = tmp_path / "data-manifest.json"
    manifest_path.write_text("{ not json")

    exit_code = emit_archives(tmp_path / "archives", data_root=data_root, manifest_path=manifest_path)

    assert exit_code == 1


def test_emit_archives_refuses_a_directory_holding_only_symlinks(tmp_path):
    # pack() excludes symlinks, so a directory of nothing but links produces an empty archive under
    # a real-looking tag. The emptiness guard has to count the same files the packer will.
    data_root = build_data_root(tmp_path / "data")
    target = tmp_path / "outside.json"
    target.write_text("payload")
    for path in (data_root / "configuration").iterdir():
        path.unlink()
    (data_root / "configuration" / "link.json").symlink_to(target)
    output = tmp_path / "archives"

    exit_code = emit_archives(output, data_root=data_root, manifest_path=tmp_path / "absent.json")

    assert exit_code == 1
    assert not (output / PLAN_FILENAME).exists()
