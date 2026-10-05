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
"""Validated indexes and atomic, content-addressed README storage."""

import logging
import os
import re
import tempfile
from collections.abc import Iterable
from pathlib import Path

import yaml

from .content_hashing import compute_content_hash

logger = logging.getLogger(__name__)


def sanitize_name(name: str) -> str:
    """Retain the historical filename spelling while preventing path traversal."""
    return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)


def readme_filename(name: str, content: str) -> str:
    """Return the content-addressed filename for a raw inventory name."""
    return f"{sanitize_name(name)}-{compute_content_hash(content)}.md"


def parse_readme_filename(filename: str) -> tuple[str, str] | None:
    """Parse a safe README basename into its sanitized name and hash."""
    if "/" in filename or "\\" in filename:
        return None
    match = re.fullmatch(r"(.+)-([a-f0-9]{12})\.md", filename)
    return (match[1], match[2]) if match else None


def _validate_index(index: object) -> dict[str, str]:
    if not isinstance(index, dict):
        raise ValueError("README index must be an explicit mapping")
    for name, filename in index.items():
        if not isinstance(name, str) or not isinstance(filename, str):
            raise ValueError("README index keys and filenames must be strings")
        parsed = parse_readme_filename(filename)
        if parsed is None or parsed[0] != sanitize_name(name):
            raise ValueError(f"Invalid README filename for {name!r}: {filename!r}")
    return index


class _UniqueKeyLoader(yaml.SafeLoader):
    """Reject duplicates rather than silently discarding an index reference."""

    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str) or key in result:
                raise ValueError(f"Invalid or duplicate README index key: {key!r}")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def read_readme_index(path: Path) -> dict[str, str]:
    """Read a complete index; only a missing file is treated as an empty map."""
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    try:
        # This loader subclasses SafeLoader and only adds duplicate-key validation.
        return _validate_index(yaml.load(content, Loader=_UniqueKeyLoader))  # noqa: S506
    except yaml.YAMLError as error:
        raise ValueError(f"Invalid README index: {path}") from error


def _atomic_write(path: Path, content: bytes) -> None:
    """Publish complete bytes, preserving the previous destination on failure."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".readme-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def write_readme_index(path: Path, index: dict[str, str]) -> None:
    """Validate and atomically publish a deterministic completion index."""
    _validate_index(index)
    content = yaml.safe_dump(index, sort_keys=True, allow_unicode=True)
    _atomic_write(path, content.encode("utf-8"))


class ReadmeStore:
    """Shared immutable README blobs for one distribution."""

    def __init__(self, store_dir: Path):
        self.store_dir = store_dir

    def save(self, readmes: Iterable[tuple[str, str]]) -> tuple[dict[str, str], int]:
        """Store all blobs before returning an index and newly written count."""
        index = {}
        blobs = {}
        for name, content in readmes:
            filename = readme_filename(name, content)
            if name in index and index[name] != filename:
                raise ValueError(f"Multiple README contents for {name!r}")
            index[name] = filename
            data = content.encode("utf-8")
            if filename in blobs and blobs[filename] != data:
                raise ValueError(f"Conflicting README bytes: {filename}")
            blobs[filename] = data
        _validate_index(index)
        written = 0
        for filename, data in blobs.items():
            path = self.store_dir / filename
            try:
                existing = path.read_bytes()
            except FileNotFoundError:
                _atomic_write(path, data)
                written += 1
            else:
                if existing != data:
                    raise ValueError(f"Conflicting README bytes: {path}")
        return index, written

    def read(self, filename: str) -> str | None:
        """Read a safe basename, preserving best-effort reads for missing/unreadable blobs."""
        if parse_readme_filename(filename) is None:
            raise ValueError(f"Invalid README filename: {filename!r}")
        try:
            return (self.store_dir / filename).read_bytes().decode("utf-8")
        except FileNotFoundError:
            return None
        except OSError as error:
            logger.error("Failed to read README file '%s': %s", self.store_dir / filename, error)
            return None

    def prune(self, referenced: set[str]) -> int:
        """Delete unreferenced blobs after callers validate every version index."""
        removed = 0
        for path in self.store_dir.glob("*.md"):
            if path.name not in referenced:
                path.unlink()
                removed += 1
        return removed
