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
"""Writes JavaScript instrumentation data to content-addressed file storage.

js-contrib packages version independently and most releases only bump the version
number, so package files don't carry a version. Releases with identical metadata
hash to the same file, and index.json maps each version to its file:

    javascript/
        index.json                                  # every package, its releases, version -> hash
        packages/{package}/{package}-{hash}.json    # metadata shared by one or more releases
"""

import json
import logging
import re
import shutil
from pathlib import Path
from typing import Any

from explorer_db_builder.content_hashing import content_hash
from explorer_db_builder.orphan_gc import read_json

logger = logging.getLogger(__name__)


class JavascriptDatabaseWriter:
    """Manages writing JS instrumentation packages to a content-addressed file system database."""

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/javascript") -> None:
        self.database_dir = Path(database_dir)
        self.files_written = 0
        self.total_bytes = 0

    def _sanitize_name(self, name: str) -> str:
        """Sanitizes a name for use as a filename to prevent path traversal."""
        return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)

    def _write_json(self, path: Path, data: Any) -> None:
        content = json.dumps(data, indent=2, sort_keys=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        self.files_written += 1
        self.total_bytes += len(content.encode("utf-8"))

    def _package_file(self, package_name: str, package_hash: str) -> Path:
        """Content-addressed path for package metadata (does not create its directory)."""
        safe_name = self._sanitize_name(package_name)
        return self.database_dir / "packages" / safe_name / f"{safe_name}-{package_hash}.json"

    def write_package(self, package: dict[str, Any]) -> str:
        """Write package metadata to its content-addressed file.

        Callers pass metadata without a version, so releases that only bumped the
        version share one file.

        Args:
            package: Package metadata. Must have a "name".

        Returns:
            The 12-char content hash.

        Raises:
            ValueError: If the package has no name.
            OSError: If file writing fails.
        """
        package_name = package.get("name")
        if not package_name:
            raise ValueError("Package is missing a 'name' field")

        package_hash = content_hash(package)
        file_path = self._package_file(package_name, package_hash)

        if file_path.exists():
            logger.debug("Package '%s' hash %s already exists, skipping", package_name, package_hash)
            return package_hash

        file_path.parent.mkdir(parents=True, exist_ok=True)
        self._write_json(file_path, package)
        logger.debug("Wrote package '%s' hash %s", package_name, package_hash)
        return package_hash

    def write_index(self, packages: list[dict[str, Any]]) -> None:
        """Write index.json, the list of every package and the file each release uses.

        Args:
            packages: Index entries, already sorted. Each has a "releases" list of
                {"version", "hash"}.

        Raises:
            OSError: If file writing fails.
        """
        self.database_dir.mkdir(parents=True, exist_ok=True)
        index_file = self.database_dir / "index.json"
        self._write_json(index_file, {"ecosystem": "javascript", "packages": packages})
        logger.info("Wrote javascript index with %d packages", len(packages))

    def get_stats(self) -> dict[str, Any]:
        return {"files_written": self.files_written, "total_bytes": self.total_bytes}

    def remove_orphans(self) -> int:
        """Delete package files no index.json release points to.

        index.json is the only manifest here, so this can't use the shared
        ``orphan_gc`` walk, which reads per-version ``versions/*-index.json`` files.

        Returns:
            The number of files deleted.
        """
        index = read_json(self.database_dir / "index.json")
        if index is None:
            # Without a readable index, reachability is unknown and an empty live
            # set would delete everything. Skip rather than guess.
            logger.warning("Skipping javascript orphan GC: no readable index.json in %s", self.database_dir)
            return 0

        live: set[Path] = set()
        for package in index.get("packages") or []:
            for release in package.get("releases") or []:
                live.add(self._package_file(package["name"], release["hash"]))

        packages_dir = self.database_dir / "packages"
        if not packages_dir.is_dir():
            return 0

        removed = 0
        for path in packages_dir.glob("*/*.json"):
            if path in live:
                continue
            try:
                path.unlink()
                removed += 1
            except OSError as e:
                logger.warning("Failed to remove orphaned file %s: %s", path, e)

        for child in packages_dir.iterdir():
            if child.is_dir() and not any(child.iterdir()):
                child.rmdir()

        if removed:
            logger.info("Removed %d orphaned file(s) from %s", removed, self.database_dir)
        return removed

    def clean(self) -> None:
        """Remove the javascript database directory and recreate it empty.

        The directory is builder-owned: everything under it goes, including files this
        tool did not write. Curated content the frontend fetches must live outside it
        (see the "Methodology" section of the explorer-db-builder README).
        """
        if self.database_dir.exists():
            logger.info("Cleaning javascript database directory: %s", self.database_dir)
            shutil.rmtree(self.database_dir)
        self.database_dir.mkdir(parents=True, exist_ok=True)
