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
"""Tests for reading, merging and writing data-manifest.json."""

import json

import pytest
from explorer_db_builder.data_manifest import (
    asset_name,
    committed_digest,
    main,
    read_manifest,
    update_entry,
    write_manifest,
)


def entry_for(ecosystem="javaagent", digest="a" * 64):
    # Built with the production constructor so a new field cannot drift out of the fixtures.
    manifest = update_entry(
        {"ecosystems": {}},
        ecosystem=ecosystem,
        release_tag=f"data-{ecosystem}-{digest[:12]}",
        content_digest=digest,
        archive_sha256="b" * 64,
        registry_commit="c" * 40,
    )
    return manifest["ecosystems"][ecosystem]


def test_read_manifest_of_a_missing_file_is_empty(tmp_path):
    assert read_manifest(tmp_path / "absent.json") == {"ecosystems": {}}


def test_read_manifest_of_a_blank_file_is_empty(tmp_path):
    path = tmp_path / "data-manifest.json"
    path.write_text("   \n")

    assert read_manifest(path) == {"ecosystems": {}}


def test_read_manifest_rejects_malformed_json(tmp_path):
    path = tmp_path / "data-manifest.json"
    path.write_text("{ not json")

    with pytest.raises(ValueError, match="not valid JSON"):
        read_manifest(path)


def test_read_manifest_rejects_a_non_object_document(tmp_path):
    path = tmp_path / "data-manifest.json"
    path.write_text("[]")

    with pytest.raises(ValueError, match="JSON object"):
        read_manifest(path)


def test_read_manifest_normalizes_a_null_ecosystems_key(tmp_path):
    path = tmp_path / "data-manifest.json"
    path.write_text('{"ecosystems": null, "note": "kept"}')

    manifest = read_manifest(path)

    assert manifest["ecosystems"] == {}
    assert manifest["note"] == "kept"


def test_read_manifest_refuses_to_silently_discard_a_populated_ecosystems_key(tmp_path):
    # Coercing this to {} would erase every pin on the next write, which is the one outcome the
    # manifest exists to prevent.
    path = tmp_path / "data-manifest.json"
    path.write_text('{"ecosystems": [{"javaagent": {}}]}')

    with pytest.raises(ValueError, match="must be an object"):
        read_manifest(path)


def test_committed_digest_survives_an_absent_null_or_corrupt_block(tmp_path):
    # emit_archives asks this for all three ecosystems; one malformed block must leave that
    # ecosystem unpinned rather than abort the whole archive step.
    assert committed_digest({"ecosystems": {}}, "javaagent") is None
    assert committed_digest({"ecosystems": {"javaagent": None}}, "javaagent") is None
    assert committed_digest({"ecosystems": {"javaagent": "corrupt"}}, "javaagent") is None
    assert committed_digest({"ecosystems": {"javaagent": ["x"]}}, "javaagent") is None


def test_asset_name_is_derived_from_the_ecosystem():
    assert asset_name("collector") == "collector.tar.gz"


def test_update_entry_leaves_other_blocks_and_unknown_keys_untouched():
    manifest = {"ecosystems": {"collector": entry_for("collector", "d" * 64)}, "note": "hand written"}
    before = json.dumps(manifest["ecosystems"]["collector"], sort_keys=True)

    updated = update_entry(
        manifest,
        ecosystem="javaagent",
        release_tag="data-javaagent-aaaaaaaaaaaa",
        content_digest="a" * 64,
        archive_sha256="b" * 64,
        registry_commit="c" * 40,
    )

    assert json.dumps(updated["ecosystems"]["collector"], sort_keys=True) == before
    assert updated["ecosystems"]["javaagent"]["content_digest"] == "a" * 64
    assert updated["ecosystems"]["javaagent"]["asset"] == "javaagent.tar.gz"
    assert updated["note"] == "hand written"


def test_update_entry_rejects_a_malformed_digest():
    with pytest.raises(ValueError, match="64 hex"):
        update_entry(
            {"ecosystems": {}},
            ecosystem="javaagent",
            release_tag="data-javaagent-aaaaaaaaaaaa",
            content_digest="a" * 64,
            archive_sha256="sha256:not-hex",
            registry_commit="c" * 40,
        )


def test_write_manifest_sorts_ecosystems_and_matches_prettier(tmp_path):
    path = tmp_path / "data-manifest.json"
    manifest = {"ecosystems": {"javaagent": entry_for(), "collector": entry_for("collector", "d" * 64)}}

    write_manifest(path, manifest)

    # An exact comparison, not a substring: `'  "ecosystems"' in body` is also satisfied by four
    # and eight space indentation, so it would not catch the change that breaks format:check.
    body = path.read_text()
    expected = {"ecosystems": {"collector": entry_for("collector", "d" * 64), "javaagent": entry_for()}}
    assert body == json.dumps(expected, indent=2) + "\n"
    assert list(json.loads(body)["ecosystems"]) == ["collector", "javaagent"]


def valid_fields():
    return {
        "release_tag": "data-javaagent-aaaaaaaaaaaa",
        "content_digest": "a" * 64,
        "archive_sha256": "b" * 64,
        "registry_commit": "c" * 40,
    }


def test_update_entry_rejects_an_empty_release_tag():
    fields = valid_fields() | {"release_tag": "  "}

    with pytest.raises(ValueError, match="release_tag must not be empty"):
        update_entry({"ecosystems": {}}, ecosystem="javaagent", **fields)


def test_update_entry_rejects_a_registry_commit_that_is_not_a_sha():
    # The workflow passes $GITHUB_SHA. An empty or truncated value would silently make the entry
    # unreproducible, which is the one thing registry_commit exists to guarantee.
    for bad in ("", "  ", "not-a-sha", "abc", "g" * 40, "a" * 41):
        with pytest.raises(ValueError, match="registry_commit"):
            update_entry({"ecosystems": {}}, ecosystem="javaagent", **(valid_fields() | {"registry_commit": bad}))


def test_main_reports_an_io_error_without_a_traceback(tmp_path):
    # The manifest path is a directory, so write_manifest raises IsADirectoryError. Every other
    # failure in this module is a logged line and exit 1; this one must be too.
    directory = tmp_path / "manifest-as-a-directory"
    directory.mkdir()

    exit_code = main(
        [
            "--manifest",
            str(directory),
            "--ecosystem",
            "javaagent",
            "--release-tag",
            "data-javaagent-aaaaaaaaaaaa",
            "--content-digest",
            "a" * 64,
            "--archive-sha256",
            "b" * 64,
            "--registry-commit",
            "c" * 40,
        ]
    )

    assert exit_code == 1


def test_write_manifest_is_idempotent(tmp_path):
    path = tmp_path / "data-manifest.json"
    write_manifest(path, {"ecosystems": {"javaagent": entry_for()}})
    first = path.read_text()

    write_manifest(path, read_manifest(path))

    assert path.read_text() == first


def test_main_updates_one_block_in_place(tmp_path):
    path = tmp_path / "data-manifest.json"
    write_manifest(path, {"ecosystems": {"collector": entry_for("collector", "d" * 64)}})

    exit_code = main(
        [
            "--manifest",
            str(path),
            "--ecosystem",
            "javaagent",
            "--release-tag",
            "data-javaagent-aaaaaaaaaaaa",
            "--content-digest",
            "a" * 64,
            "--archive-sha256",
            "b" * 64,
            "--registry-commit",
            "c" * 40,
        ]
    )

    assert exit_code == 0
    written = json.loads(path.read_text())
    assert written["ecosystems"]["javaagent"]["asset"] == "javaagent.tar.gz"
    assert written["ecosystems"]["collector"]["content_digest"] == "d" * 64


def test_main_rejects_an_unknown_ecosystem(tmp_path):
    exit_code = main(
        [
            "--manifest",
            str(tmp_path / "data-manifest.json"),
            "--ecosystem",
            "nonsense",
            "--release-tag",
            "t",
            "--content-digest",
            "a" * 64,
            "--archive-sha256",
            "b" * 64,
            "--registry-commit",
            "c" * 40,
        ]
    )

    assert exit_code == 1


def test_main_rejects_a_malformed_archive_sha256(tmp_path):
    path = tmp_path / "data-manifest.json"

    exit_code = main(
        [
            "--manifest",
            str(path),
            "--ecosystem",
            "javaagent",
            "--release-tag",
            "data-javaagent-aaaaaaaaaaaa",
            "--content-digest",
            "a" * 64,
            "--archive-sha256",
            "null",
            "--registry-commit",
            "c" * 40,
        ]
    )

    assert exit_code == 1
    assert not path.exists()
