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
"""Byte-reproducible archives and tree digests for the generated database.

Two values describe an archive and they answer different questions. The tree digest is taken over
the unpacked files, so it knows nothing about tar or gzip and is the only safe key for change
detection. The archive's own sha256 covers the served bytes and is transport integrity only.

Unrelated to content_hashing.content_hash, which normalizes a JSON object and truncates to 12.
"""

import gzip
import hashlib
import os
import tarfile
from pathlib import Path

# Every field tar would otherwise read from the filesystem is pinned, so the same tree always packs
# to the same bytes regardless of when or where it was built.
FIXED_MTIME = 0
FIXED_MODE = 0o644
COMPRESS_LEVEL = 9

TAG_DIGEST_LENGTH = 12


def relative_files(directory: Path) -> list[str]:
    """List the regular files under a directory, sorted for reproducible packing.

    Symlinks are excluded: Path.is_file() follows them, so a link would otherwise be packed as a
    second copy of its target and hashed twice.

    Args:
        directory: Root to walk.

    Returns:
        Relative POSIX paths sorted on their encoded bytes, matching `LC_ALL=C sort`.

    Raises:
        ValueError: If the directory does not exist. Also if a path contains a newline or a
            backslash, which GNU sha256sum escapes and marks with a leading backslash, or if a path
            starts with a dash, which sha256sum parses as an option rather than a file. Each of
            those would make the shell cross-check disagree with this digest, and the contract gate
            would report a perfectly good archive as corrupt.
    """
    if not directory.is_dir():
        raise ValueError(f"{directory} is not a directory")
    paths = [
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file() and not path.is_symlink()
    ]
    for path in paths:
        if "\n" in path:
            raise ValueError(f"Path contains a newline, which cannot round-trip through sha256sum: {path!r}")
        if path.startswith("-"):
            raise ValueError(f"Path starts with a dash, which sha256sum parses as an option: {path!r}")
        if "\\" in path:
            raise ValueError(f"Path contains a backslash, which cannot round-trip through sha256sum: {path!r}")
    return sorted(paths, key=os.fsencode)


def tree_digest(directory: Path) -> str:
    """Digest the unpacked tree, independently of how it is packaged.

    The hashed lines are `sha256sum` output format on purpose, so the value can be reproduced
    without the builder. `.github/scripts/content-digest.sh` is that reproduction, and the contract
    gate uses it rather than calling back here, so a bug cannot agree with itself.

    Args:
        directory: Root of the tree to digest.

    Returns:
        Hex sha256 over the sorted `<file sha256>  <relative path>\\n` lines.
    """
    digest = hashlib.sha256()
    for relative in relative_files(directory):
        with (directory / relative).open("rb") as handle:
            file_hash = hashlib.file_digest(handle, "sha256").hexdigest()
        digest.update(os.fsencode(f"{file_hash}  {relative}\n"))
    return digest.hexdigest()


def pack(directory: Path, destination: Path) -> None:
    """Write a directory to a byte-reproducible .tar.gz.

    Directory entries are omitted and members carry no identity or timestamp, so two runs over the
    same content produce identical bytes.

    Args:
        directory: Root whose files become the archive members.
        destination: Path of the .tar.gz to write. Parent directories are created.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    names = relative_files(directory)
    with destination.open("wb") as raw:
        # An empty filename and a zero mtime keep the gzip header from carrying the moment and the
        # machine the archive was built on.
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=COMPRESS_LEVEL) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.GNU_FORMAT) as archive:
                for relative in names:
                    source = directory / relative
                    info = tarfile.TarInfo(relative)
                    info.size = source.stat().st_size
                    info.mtime = FIXED_MTIME
                    info.mode = FIXED_MODE
                    info.uid = 0
                    info.gid = 0
                    info.uname = ""
                    info.gname = ""
                    with source.open("rb") as handle:
                        archive.addfile(info, handle)


def release_tag(ecosystem: str, digest: str) -> str:
    """Name the release that carries an ecosystem's archive.

    Deriving the tag from the content makes publication idempotent: unchanged content resolves to a
    tag that already exists, so the nightly publishes nothing, and changed content cannot collide
    with a tag the organization ruleset has already made immutable.

    Args:
        ecosystem: One of ecosystems.ECOSYSTEMS.
        digest: That ecosystem's tree digest.

    Returns:
        A tag of the form `data-<ecosystem>-<first 12 hex characters>`.
    """
    return f"data-{ecosystem}-{digest[:TAG_DIGEST_LENGTH]}"
