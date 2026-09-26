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
"""Tests for deterministic archive packing and tree digests."""

import gzip
import hashlib
import os
import tarfile
from pathlib import Path

import pytest
from explorer_db_builder.archive_writer import pack, relative_files, release_tag, tree_digest


def build_tree(root: Path, files: dict[str, str]) -> Path:
    for name, body in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)
    return root


def test_relative_files_sorts_on_encoded_bytes(tmp_path):
    build_tree(tmp_path, {"b/two.json": "2", "a/one.json": "1", "A/zero.json": "0"})

    # Uppercase sorts before lowercase in byte order; a locale-aware sort would not agree.
    assert relative_files(tmp_path) == ["A/zero.json", "a/one.json", "b/two.json"]


def test_relative_files_skips_directories_and_symlinks(tmp_path):
    build_tree(tmp_path, {"real.json": "{}"})
    (tmp_path / "empty-dir").mkdir()
    (tmp_path / "link.json").symlink_to(tmp_path / "real.json")

    assert relative_files(tmp_path) == ["real.json"]


def test_relative_files_rejects_a_newline_in_a_path(tmp_path):
    build_tree(tmp_path, {"new\nline.json": "x"})

    # GNU sha256sum escapes such a line and prefixes it with a backslash, so the shell cross-check
    # in the contract gate could never agree with a raw Python digest. Fail with a named cause
    # instead of emitting a digest the gate will report as a corrupt archive.
    with pytest.raises(ValueError, match="newline"):
        relative_files(tmp_path)


def test_relative_files_rejects_a_backslash_in_a_path(tmp_path):
    build_tree(tmp_path, {"we\\ird.json": "x"})

    with pytest.raises(ValueError, match="backslash"):
        relative_files(tmp_path)


def test_relative_files_rejects_a_leading_dash(tmp_path):
    build_tree(tmp_path, {"-n.json": "x"})

    # GNU getopt permutes, so sha256sum would parse this as an option and the contract gate would
    # report a perfectly good archive as broken.
    with pytest.raises(ValueError, match="dash"):
        relative_files(tmp_path)


def test_relative_files_rejects_a_missing_directory(tmp_path):
    # rglob swallows a missing directory, so without this both tree_digest and pack would quietly
    # report an empty tree: three empty archives published under legitimate-looking tags.
    with pytest.raises(ValueError, match="not a directory"):
        relative_files(tmp_path / "absent")


def test_tree_digest_is_the_documented_sha256sum_pipeline(tmp_path):
    build_tree(tmp_path, {"b.json": "second", "a.json": "first"})

    expected = hashlib.sha256()
    for name, body in [("a.json", "first"), ("b.json", "second")]:
        file_hash = hashlib.sha256(body.encode()).hexdigest()
        expected.update(f"{file_hash}  {name}\n".encode())

    assert tree_digest(tmp_path) == expected.hexdigest()


def test_tree_digest_ignores_mtime(tmp_path):
    build_tree(tmp_path, {"a.json": "first"})
    before = tree_digest(tmp_path)

    os.utime(tmp_path / "a.json", (10**9, 10**9))

    assert tree_digest(tmp_path) == before


def test_tree_digest_changes_when_a_file_is_removed(tmp_path):
    build_tree(tmp_path, {"a.json": "first", "b.json": "second"})
    before = tree_digest(tmp_path)

    (tmp_path / "b.json").unlink()

    assert tree_digest(tmp_path) != before


def test_tree_digest_of_an_empty_tree_matches_the_shell_with_no_run_if_empty(tmp_path):
    # `xargs` without -r runs sha256sum once even with no input, which digests something else
    # entirely. .github/scripts/content-digest.sh passes -r so this value is what it produces too.
    assert tree_digest(tmp_path) == hashlib.sha256(b"").hexdigest()


def test_pack_is_byte_identical_across_runs(tmp_path):
    source = build_tree(tmp_path / "src", {"b.json": "second", "a/one.json": "first"})
    os.utime(source / "a/one.json", (10**9, 10**9))
    first = tmp_path / "first.tar.gz"
    second = tmp_path / "second.tar.gz"

    pack(source, first)
    os.utime(source / "b.json", (1500000000, 1500000000))
    pack(source, second)

    assert first.read_bytes() == second.read_bytes()


def test_pack_embeds_no_gzip_filename_or_timestamp(tmp_path):
    # This is the deterministic guard against a dropped mtime=0; the test above needs no sleep.
    source = build_tree(tmp_path / "src", {"a.json": "first"})
    destination = tmp_path / "out.tar.gz"
    pack(source, destination)

    with gzip.open(destination, "rb") as handle:
        handle.read(1)
        assert handle.mtime == 0
    # Byte 3 of the gzip header is FLG; bit 3 (FNAME) must be clear.
    assert destination.read_bytes()[3] & 0x08 == 0


def test_pack_zeroes_every_varying_member_field(tmp_path):
    source = build_tree(tmp_path / "src", {"a/one.json": "first"})
    destination = tmp_path / "out.tar.gz"
    pack(source, destination)

    with tarfile.open(destination, "r:gz") as archive:
        members = archive.getmembers()

    assert [m.name for m in members] == ["a/one.json"]
    member = members[0]
    assert (member.mtime, member.uid, member.gid, member.uname, member.gname) == (0, 0, 0, "", "")
    assert member.mode == 0o644


def test_pack_round_trips_long_paths(tmp_path):
    # Over 100 bytes, so the member takes the GNU LongLink header path. The real corpus has
    # 132-byte paths in collector and 128-byte paths in javaagent.
    long_name = "nested/" + "a" * 120 + ".json"
    source = build_tree(tmp_path / "src", {long_name: "payload"})
    destination = tmp_path / "out.tar.gz"
    pack(source, destination)
    restored = tmp_path / "restored"
    restored.mkdir()

    # Written out member by member rather than with extractall(filter=...). That argument only
    # exists from 3.11.4 while the package supports 3.11, and the archive is built by this test, so
    # there is nothing to sanitise.
    with tarfile.open(destination, "r:gz") as archive:
        for member in archive.getmembers():
            target = restored / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            extracted = archive.extractfile(member)
            assert extracted is not None
            target.write_bytes(extracted.read())

    assert (restored / long_name).read_text() == "payload"
    assert tree_digest(restored) == tree_digest(source)


def test_pack_handles_an_empty_directory(tmp_path):
    source = tmp_path / "src"
    source.mkdir()
    destination = tmp_path / "nested" / "out.tar.gz"

    pack(source, destination)

    with tarfile.open(destination, "r:gz") as archive:
        assert archive.getmembers() == []


def test_release_tag_uses_the_first_twelve_hex_characters():
    assert release_tag("javaagent", "a" * 64) == "data-javaagent-aaaaaaaaaaaa"
