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
"""Shared orphan garbage collection for the content-addressed writers.

DatabaseWriter and CollectorDatabaseWriter both keep an append-only,
content-addressed store and must sweep files no longer referenced by any version
index. The stores differ only in directory names and how a content file's path is
derived, so the reachability walk lives here, parameterized by those two things.
"""

import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def read_json(path: Path) -> dict[str, Any] | None:
    """Read and parse a JSON file, returning None (with a warning) on failure.

    Used by orphan GC so a single corrupt/unreadable file can't abort the sweep.
    """
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Skipping unreadable file during orphan GC: %s (%s)", path, e)
        return None


def _sweep(root: Path, pattern: str, live_paths: set[Path]) -> int:
    """Delete files under ``root`` matching ``pattern`` that aren't in ``live_paths``.

    Returns the number of files deleted.
    """
    if not root.is_dir():
        return 0

    removed = 0
    for path in root.glob(pattern):
        if path in live_paths:
            continue
        try:
            path.unlink()
            removed += 1
            logger.debug("Removed orphaned file %s", path)
        except OSError as e:
            logger.warning("Failed to remove orphaned file %s: %s", path, e)
    return removed


def remove_orphans(
    database_dir: Path,
    *,
    content_dir: str,
    index_sections: tuple[str, ...],
    content_file: Callable[[str, str], Path],
    markdown_file: Callable[[str, str], Path],
) -> int:
    """Delete content-addressed files no longer referenced by any version index.

    The store is append-only: writers skip a write when a file with that hash
    already exists, so a changed content hash leaves the old file behind forever
    without a full ``--clean``. This walks the store and deletes anything not
    referenced by the current indexes.

    Args:
        database_dir: Root of the content-addressed store.
        content_dir: Content subdirectory ("components" / "instrumentations").
        index_sections: Keys in each ``versions/*-index.json`` whose ``{key: hash}``
            maps reference live content files.
        content_file: Maps ``(index key, hash)`` to a content file path.
        markdown_file: Maps ``(name, markdown_hash)`` to a markdown file path.

    Returns:
        The number of files deleted.
    """
    versions_dir = database_dir / "versions"
    if not versions_dir.is_dir():
        return 0

    live_content: set[Path] = set()
    readable_indexes = 0
    for index_file in versions_dir.glob("*-index.json"):
        data = read_json(index_file)
        if data is None:
            continue
        readable_indexes += 1
        for section in index_sections:
            for key, item_hash in (data.get(section) or {}).items():
                live_content.add(content_file(key, item_hash))

    # If no version index was readable, reachability is unknown and an empty
    # live set would sweep the entire store. Skip GC rather than delete everything.
    if readable_indexes == 0:
        logger.warning("Skipping orphan GC: no readable version index found in %s", versions_dir)
        return 0

    # Markdown is reachable only via markdown_hash inside each live content file.
    live_markdown: set[Path] = set()
    for path in live_content:
        data = read_json(path)
        if data is None:
            continue
        name = data.get("name")
        markdown_hash = data.get("markdown_hash")
        if name and markdown_hash:
            live_markdown.add(markdown_file(name, markdown_hash))

    # Bundle hashes live only in the top-level versions-index.json.
    live_bundles: set[Path] = set()
    versions_index = database_dir / "versions-index.json"
    version_list = read_json(versions_index) if versions_index.exists() else None
    if version_list is not None:
        for entry in version_list.get("versions") or []:
            bundle_hash = entry.get("bundle_hash")
            version = entry.get("version")
            if bundle_hash and version:
                live_bundles.add(database_dir / "bundles" / f"{version}-{bundle_hash}.json")

    removed = 0
    removed += _sweep(database_dir / content_dir, "*/*.json", live_content)
    removed += _sweep(database_dir / "bundles", "*.json", live_bundles)
    removed += _sweep(database_dir / "markdown", "*.md", live_markdown)

    # Prune content subdirectories emptied by the sweep above.
    content_root = database_dir / content_dir
    if content_root.is_dir():
        for child in content_root.iterdir():
            if child.is_dir() and not any(child.iterdir()):
                child.rmdir()

    if removed:
        logger.info("Removed %d orphaned file(s) from %s", removed, database_dir)
    return removed
