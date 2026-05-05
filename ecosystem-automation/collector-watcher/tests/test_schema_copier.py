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
"""Tests for CollectorSchemaCopier."""

import hashlib
import shutil
import tempfile
from pathlib import Path

import pytest
from collector_watcher.schema_copier import (
    SCHEMA_FILENAME,
    SCHEMA_RELATIVE_PATH,
    UNKNOWN_HASH,
    CollectorSchemaCopier,
)


@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp()
    yield Path(d)
    shutil.rmtree(d)


@pytest.fixture
def fake_repo(temp_dir):
    """Fake repo directory with a metadata-schema.yaml at the expected location."""
    schema_dir = temp_dir / "cmd" / "mdatagen"
    schema_dir.mkdir(parents=True)
    schema_file = schema_dir / "metadata-schema.yaml"
    schema_file.write_text("type: object\nproperties:\n  type:\n    type: string\n")
    return temp_dir


@pytest.fixture
def fake_repo_no_schema(temp_dir):
    """Fake repo directory without a metadata-schema.yaml."""
    (temp_dir / "cmd" / "mdatagen").mkdir(parents=True)
    return temp_dir


@pytest.fixture
def target_dir(temp_dir):
    d = temp_dir / "target"
    d.mkdir()
    return d


# ---------------------------------------------------------------------------
# copy_schema
# ---------------------------------------------------------------------------


def test_copy_schema_copies_file(fake_repo, target_dir):
    copier = CollectorSchemaCopier()
    result = copier.copy_schema(fake_repo, target_dir)

    assert result == SCHEMA_FILENAME
    assert (target_dir / SCHEMA_FILENAME).exists()


def test_copy_schema_content_is_identical(fake_repo, target_dir):
    copier = CollectorSchemaCopier()
    copier.copy_schema(fake_repo, target_dir)

    src = fake_repo / SCHEMA_RELATIVE_PATH
    dst = target_dir / SCHEMA_FILENAME
    assert dst.read_bytes() == src.read_bytes()


def test_copy_schema_creates_target_dir_if_missing(fake_repo, temp_dir):
    target = temp_dir / "nested" / "newdir"
    assert not target.exists()

    copier = CollectorSchemaCopier()
    copier.copy_schema(fake_repo, target)

    assert (target / SCHEMA_FILENAME).exists()


def test_copy_schema_returns_none_when_schema_absent(fake_repo_no_schema, target_dir):
    copier = CollectorSchemaCopier()
    result = copier.copy_schema(fake_repo_no_schema, target_dir)

    assert result is None
    assert not (target_dir / SCHEMA_FILENAME).exists()


def test_copy_schema_overwrites_existing_file(fake_repo, target_dir):
    old_content = "old content"
    (target_dir / SCHEMA_FILENAME).write_text(old_content)

    copier = CollectorSchemaCopier()
    copier.copy_schema(fake_repo, target_dir)

    new_content = (target_dir / SCHEMA_FILENAME).read_text()
    assert new_content != old_content


# ---------------------------------------------------------------------------
# compute_schema_hash
# ---------------------------------------------------------------------------


def test_compute_schema_hash_returns_12_char_hex(fake_repo):
    schema_path = fake_repo / SCHEMA_RELATIVE_PATH
    copier = CollectorSchemaCopier()
    result = copier.compute_schema_hash(schema_path)

    assert isinstance(result, str)
    assert len(result) == 12
    assert all(c in "0123456789abcdef" for c in result)


def test_compute_schema_hash_matches_sha256(fake_repo):
    schema_path = fake_repo / SCHEMA_RELATIVE_PATH
    copier = CollectorSchemaCopier()
    result = copier.compute_schema_hash(schema_path)

    expected = hashlib.sha256(schema_path.read_bytes()).hexdigest()[:12]
    assert result == expected


def test_compute_schema_hash_is_deterministic(fake_repo):
    schema_path = fake_repo / SCHEMA_RELATIVE_PATH
    copier = CollectorSchemaCopier()

    h1 = copier.compute_schema_hash(schema_path)
    h2 = copier.compute_schema_hash(schema_path)
    assert h1 == h2


def test_compute_schema_hash_changes_with_content(fake_repo):
    schema_path = fake_repo / SCHEMA_RELATIVE_PATH
    copier = CollectorSchemaCopier()

    h1 = copier.compute_schema_hash(schema_path)
    schema_path.write_text("type: object\nnewfield: added\n")
    h2 = copier.compute_schema_hash(schema_path)

    assert h1 != h2


def test_compute_schema_hash_returns_unknown_when_absent(temp_dir):
    missing = temp_dir / "does_not_exist.yaml"
    copier = CollectorSchemaCopier()
    result = copier.compute_schema_hash(missing)

    assert result == UNKNOWN_HASH


# ---------------------------------------------------------------------------
# Round-trip: copy then hash the copy
# ---------------------------------------------------------------------------


def test_hash_of_copy_matches_hash_of_source(fake_repo, target_dir):
    """The hash of the copied file must equal the hash of the source."""
    copier = CollectorSchemaCopier()
    copier.copy_schema(fake_repo, target_dir)

    src_hash = copier.compute_schema_hash(fake_repo / SCHEMA_RELATIVE_PATH)
    dst_hash = copier.compute_schema_hash(target_dir / SCHEMA_FILENAME)

    assert src_hash == dst_hash
