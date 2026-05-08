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
def schemas_dir(temp_dir):
    return temp_dir / "meta" / "schemas"


# ---------------------------------------------------------------------------
# store_schema
# ---------------------------------------------------------------------------


def test_store_schema_writes_hash_named_file(fake_repo, schemas_dir):
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, schemas_dir)

    assert schema_hash is not None
    assert len(schema_hash) == 12
    assert (schemas_dir / f"{schema_hash}.yaml").exists()


def test_store_schema_returns_hash_matching_content(fake_repo, schemas_dir):
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, schemas_dir)

    src = fake_repo / SCHEMA_RELATIVE_PATH
    expected = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
    assert schema_hash == expected


def test_store_schema_content_is_identical(fake_repo, schemas_dir):
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, schemas_dir)

    src = fake_repo / SCHEMA_RELATIVE_PATH
    dst = schemas_dir / f"{schema_hash}.yaml"
    assert dst.read_bytes() == src.read_bytes()


def test_store_schema_creates_schemas_dir_if_missing(fake_repo, temp_dir):
    target = temp_dir / "deeply" / "nested" / "schemas"
    assert not target.exists()

    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, target)

    assert schema_hash is not None
    assert (target / f"{schema_hash}.yaml").exists()


def test_store_schema_returns_none_when_schema_absent(fake_repo_no_schema, schemas_dir):
    copier = CollectorSchemaCopier()
    result = copier.store_schema(fake_repo_no_schema, schemas_dir)

    assert result is None
    # No file should be created when source is absent
    assert not schemas_dir.exists() or not any(schemas_dir.iterdir())


def test_store_schema_is_idempotent(fake_repo, schemas_dir):
    """Calling store_schema twice with identical source produces one file."""
    copier = CollectorSchemaCopier()
    h1 = copier.store_schema(fake_repo, schemas_dir)
    h2 = copier.store_schema(fake_repo, schemas_dir)

    assert h1 == h2
    files = list(schemas_dir.glob("*.yaml"))
    assert len(files) == 1


def test_store_schema_does_not_overwrite_existing_file(fake_repo, schemas_dir):
    """The first stored content wins; later calls must not modify the existing file."""
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, schemas_dir)

    stored_path = schemas_dir / f"{schema_hash}.yaml"
    mtime_before = stored_path.stat().st_mtime_ns

    # A second call with the same source must skip the copy entirely
    copier.store_schema(fake_repo, schemas_dir)
    assert stored_path.stat().st_mtime_ns == mtime_before


def test_store_schema_distinct_contents_produce_distinct_files(fake_repo, schemas_dir, temp_dir):
    """Two repos with different schemas yield two files in CAS."""
    copier = CollectorSchemaCopier()
    h1 = copier.store_schema(fake_repo, schemas_dir)

    other_repo = temp_dir / "other"
    other_schema_dir = other_repo / "cmd" / "mdatagen"
    other_schema_dir.mkdir(parents=True)
    (other_schema_dir / "metadata-schema.yaml").write_text("type: different\n")

    h2 = copier.store_schema(other_repo, schemas_dir)

    assert h1 != h2
    assert (schemas_dir / f"{h1}.yaml").exists()
    assert (schemas_dir / f"{h2}.yaml").exists()


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
# Round-trip: store then hash the stored copy
# ---------------------------------------------------------------------------


def test_hash_of_stored_file_matches_computed_hash(fake_repo, schemas_dir):
    """The filename of the stored copy must equal the source hash."""
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema(fake_repo, schemas_dir)

    src_hash = copier.compute_schema_hash(fake_repo / SCHEMA_RELATIVE_PATH)
    assert schema_hash == src_hash
    assert (schemas_dir / f"{src_hash}.yaml").exists()
