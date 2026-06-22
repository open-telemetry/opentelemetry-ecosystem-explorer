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
"""Tests for CollectorSchemaCopier (content-addressable, normalized hashing)."""

import shutil
import tempfile
from pathlib import Path

import pytest
from collector_watcher.schema_copier import (
    UNKNOWN_HASH,
    CollectorSchemaCopier,
)

# A small but representative schema. Its hash under the pinned normalization is
# pinned as a literal below so the test fails loudly if the canonical form ever
# changes (e.g. a PyYAML dump-option drift) — that change requires a backfill.
SCHEMA_CONTENT = "type: object\nproperties:\n  type:\n    type: string\n"
SCHEMA_CONTENT_HASH = "688b0c283893"


@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp()
    yield Path(d)
    shutil.rmtree(d)


@pytest.fixture
def schemas_dir(temp_dir):
    return temp_dir / "meta" / "schemas"


# ---------------------------------------------------------------------------
# store_schema_content
# ---------------------------------------------------------------------------


def test_store_schema_content_writes_hash_named_file(schemas_dir):
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)

    assert schema_hash == SCHEMA_CONTENT_HASH
    assert (schemas_dir / f"{schema_hash}.yaml").exists()


def test_store_schema_content_is_verbatim(schemas_dir):
    """The stored file keeps the original content; only the name is hashed."""
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)

    dst = schemas_dir / f"{schema_hash}.yaml"
    assert dst.read_text(encoding="utf-8") == SCHEMA_CONTENT


def test_store_schema_content_creates_schemas_dir_if_missing(temp_dir):
    target = temp_dir / "deeply" / "nested" / "schemas"
    assert not target.exists()

    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema_content(SCHEMA_CONTENT, target)

    assert schema_hash is not None
    assert (target / f"{schema_hash}.yaml").exists()


def test_store_schema_content_returns_none_when_content_none(schemas_dir):
    copier = CollectorSchemaCopier()
    result = copier.store_schema_content(None, schemas_dir)

    assert result is None
    # No file/dir should be created when there is nothing to store.
    assert not schemas_dir.exists() or not any(schemas_dir.iterdir())


def test_store_schema_content_is_idempotent(schemas_dir):
    """Storing identical content twice produces a single file."""
    copier = CollectorSchemaCopier()
    h1 = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)
    h2 = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)

    assert h1 == h2
    assert len(list(schemas_dir.glob("*.yaml"))) == 1


def test_store_schema_content_does_not_overwrite_existing_file(schemas_dir):
    """The first stored content wins; later calls must not rewrite the file."""
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)

    stored_path = schemas_dir / f"{schema_hash}.yaml"
    mtime_before = stored_path.stat().st_mtime_ns

    copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)
    assert stored_path.stat().st_mtime_ns == mtime_before


def test_store_schema_content_distinct_contents_produce_distinct_files(schemas_dir):
    copier = CollectorSchemaCopier()
    h1 = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)
    h2 = copier.store_schema_content("type: different\n", schemas_dir)

    assert h1 != h2
    assert (schemas_dir / f"{h1}.yaml").exists()
    assert (schemas_dir / f"{h2}.yaml").exists()


# ---------------------------------------------------------------------------
# compute_schema_hash
# ---------------------------------------------------------------------------


def test_compute_schema_hash_returns_12_char_hex():
    result = CollectorSchemaCopier().compute_schema_hash(SCHEMA_CONTENT)

    assert isinstance(result, str)
    assert len(result) == 12
    assert all(c in "0123456789abcdef" for c in result)


def test_compute_schema_hash_pins_known_input():
    """Guards the canonical form against silent drift (independent expectation)."""
    assert CollectorSchemaCopier().compute_schema_hash(SCHEMA_CONTENT) == SCHEMA_CONTENT_HASH


def test_compute_schema_hash_is_deterministic():
    copier = CollectorSchemaCopier()
    assert copier.compute_schema_hash(SCHEMA_CONTENT) == copier.compute_schema_hash(SCHEMA_CONTENT)


def test_compute_schema_hash_changes_with_content():
    copier = CollectorSchemaCopier()
    h1 = copier.compute_schema_hash(SCHEMA_CONTENT)
    h2 = copier.compute_schema_hash("type: object\nnewfield: added\n")

    assert h1 != h2


def test_compute_schema_hash_returns_unknown_when_content_none():
    assert CollectorSchemaCopier().compute_schema_hash(None) == UNKNOWN_HASH


def test_compute_schema_hash_ignores_comments():
    copier = CollectorSchemaCopier()
    with_comments = f"# leading comment\n{SCHEMA_CONTENT}\n# trailing comment\n"

    assert copier.compute_schema_hash(with_comments) == copier.compute_schema_hash(SCHEMA_CONTENT)


def test_compute_schema_hash_ignores_key_order():
    """sort_keys=True must make key ordering irrelevant to the hash."""
    copier = CollectorSchemaCopier()
    reordered = "properties:\n  type:\n    type: string\ntype: object\n"

    assert copier.compute_schema_hash(reordered) == copier.compute_schema_hash(SCHEMA_CONTENT)


def test_compute_schema_hash_ignores_formatting():
    """Flow vs block style is the same data, so it must hash identically."""
    copier = CollectorSchemaCopier()
    flow_style = "{type: object, properties: {type: {type: string}}}\n"

    assert copier.compute_schema_hash(flow_style) == copier.compute_schema_hash(SCHEMA_CONTENT)


# ---------------------------------------------------------------------------
# Round-trip: store, then re-hash the stored copy
# ---------------------------------------------------------------------------


def test_hash_of_stored_file_matches_computed_hash(schemas_dir):
    """Re-normalizing the stored (verbatim) file reproduces its filename hash."""
    copier = CollectorSchemaCopier()
    schema_hash = copier.store_schema_content(SCHEMA_CONTENT, schemas_dir)

    stored = (schemas_dir / f"{schema_hash}.yaml").read_text(encoding="utf-8")
    assert copier.compute_schema_hash(stored) == schema_hash
