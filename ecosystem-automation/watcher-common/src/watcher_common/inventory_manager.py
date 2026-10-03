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
"""Base inventory management for versioned artifact storage."""

import logging
import re
import shutil
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version

from .content_hashing import compute_content_hash

logger = logging.getLogger(__name__)


class BaseInventoryManager:
    """Base class for versioned inventory storage.

    Manages a flat inventory directory structure:
        inventory_dir/v{version}/

    Subclasses add domain-specific save/load methods.
    """

    def __init__(self, inventory_dir: str):
        """
        Args:
            inventory_dir: Base directory for versioned storage
        """
        self.inventory_dir = Path(inventory_dir)

    def get_version_dir(self, version: Version) -> Path:
        """
        Get the directory path for a specific version.

        Args:
            version: Version object

        Returns:
            Path to version directory (with 'v' prefix)
        """
        return self.inventory_dir / f"v{version}"

    def list_versions(self) -> list[Version]:
        """
        List all available versions.

        Returns:
            List of versions, sorted newest to oldest
        """
        if not self.inventory_dir.exists():
            return []

        versions = []
        for item in self.inventory_dir.iterdir():
            if item.is_dir():
                try:
                    # Parse version string, stripping 'v' prefix
                    # Handles "v1.0.0", "v1.0.1-SNAPSHOT"
                    version = Version(item.name.lstrip("v"))
                    versions.append(version)
                except ValueError:
                    # Skip directories that don't match version format
                    continue

        return sorted(versions, reverse=True)

    def list_snapshot_versions(self) -> list[Version]:
        """
        List all snapshot versions.

        Returns:
            List of snapshot versions
        """
        return [v for v in self.list_versions() if v.prerelease]

    def list_release_versions(self) -> list[Version]:
        """
        List all release (non-prerelease) versions.

        Returns:
            List of release versions, sorted newest to oldest
        """
        return [v for v in self.list_versions() if not v.prerelease]

    def cleanup_snapshots(self) -> int:
        """
        Remove all snapshot versions.

        Returns:
            Number of snapshot versions removed
        """
        snapshots = self.list_snapshot_versions()
        count = 0

        for snapshot in snapshots:
            snapshot_dir = self.get_version_dir(snapshot)
            if snapshot_dir.exists():
                shutil.rmtree(snapshot_dir)
                count += 1

        return count

    def version_exists(self, version: Version) -> bool:
        """
        Check if a specific version exists.

        Args:
            version: Version to check

        Returns:
            True if version directory exists
        """
        return self.get_version_dir(version).exists()

    def delete_version(self, version: Version) -> bool:
        """
        Delete a specific version directory.

        Args:
            version: Version to delete

        Returns:
            True if version was deleted, False if it didn't exist
        """
        version_dir = self.get_version_dir(version)
        if version_dir.exists():
            shutil.rmtree(version_dir)
            return True
        return False


class JavaagentInventoryManager(BaseInventoryManager):
    """Manages Java instrumentation inventory storage and retrieval."""

    FILE_NAME = "instrumentation.yaml"
    README_DIR = "library_readmes"

    def __init__(self, inventory_dir: str = "ecosystem-registry/java/javaagent"):
        """
        Args:
            inventory_dir: Base directory for versioned metadata
        """
        super().__init__(inventory_dir)

    def version_exists(self, version: Version) -> bool:
        """
        Check if a specific version exists.

        Args:
            version: Version to check

        Returns:
            True if version directory and instrumentation file exist
        """
        version_dir = self.get_version_dir(version)
        return version_dir.exists() and (version_dir / self.FILE_NAME).exists()

    def save_versioned_inventory(self, version: Version, instrumentations: dict[str, Any]) -> None:
        """
        Save inventory for a specific version.

        Args:
            version: Version object
            instrumentations: Instrumentation data dict
        """
        version_dir = self.get_version_dir(version)
        version_dir.mkdir(parents=True, exist_ok=True)

        file_path = version_dir / self.FILE_NAME

        inventory_data = {
            **instrumentations,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(inventory_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    def load_versioned_inventory(self, version: Version) -> dict[str, Any]:
        """
        Load inventory for a specific version.

        Args:
            version: Version object

        Returns:
            Inventory dictionary with full structure, or empty structure if it doesn't exist
        """
        version_dir = self.get_version_dir(version)
        file_path = version_dir / self.FILE_NAME

        if not file_path.exists():
            return {
                "file_format": 0.1,
                "libraries": [],
            }

        with open(file_path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        if not isinstance(data, dict):
            raise ValueError(f"Inventory file for version {version} must contain a mapping")

        return data

    def readme_dir_exists(self, version: Version) -> bool:
        """Return True if the library_readmes directory exists for this version."""
        return (self.get_version_dir(version) / self.README_DIR).exists()

    def _sanitize_name(self, name: str) -> str:
        """Sanitizes a name for use as a filename to prevent path traversal."""
        return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)

    def save_library_readmes(
        self,
        version: Version,
        readmes: Iterable[tuple[str, str]],  # (library_name, content)
    ) -> int:
        """Write each README content-addressed. Returns count newly written."""
        target_dir = self.get_version_dir(version) / self.README_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        written = 0
        for name, content in readmes:
            digest = compute_content_hash(content)
            safe_name = self._sanitize_name(name)
            file_path = target_dir / f"{safe_name}-{digest}.md"
            if file_path.exists():
                continue
            file_path.write_text(content, encoding="utf-8")
            written += 1
        return written

    def load_library_readme_map(self, version: Version) -> dict[str, str]:
        """
        Scan library_readmes/ and build a map of sanitized library_name -> markdown_hash.

        Args:
            version: Version to scan

        Returns:
            Dictionary mapping sanitized library names to their markdown content hashes
        """
        readme_dir = self.get_version_dir(version) / self.README_DIR
        if not readme_dir.exists():
            return {}

        selected_readmes: dict[str, tuple[str, int, str]] = {}
        seen_hashes: dict[str, set[str]] = {}

        for item in sorted(readme_dir.iterdir(), key=lambda p: p.name):
            if item.is_file() and item.suffix == ".md":
                parsed = self._parse_readme_filename(item.name)
                if parsed:
                    library_name, markdown_hash = parsed
                    seen_hashes.setdefault(library_name, set()).add(markdown_hash)

                    try:
                        mtime_ns = item.stat().st_mtime_ns
                    except OSError:
                        logger.warning("Failed to stat README file in %s: %s", version, item.name)
                        continue

                    current = selected_readmes.get(library_name)
                    if current is None:
                        selected_readmes[library_name] = (markdown_hash, mtime_ns, item.name)
                    else:
                        _, current_mtime_ns, current_name = current
                        if mtime_ns > current_mtime_ns or (mtime_ns == current_mtime_ns and item.name > current_name):
                            selected_readmes[library_name] = (markdown_hash, mtime_ns, item.name)
                else:
                    logger.warning("Malformed README filename in %s: %s", version, item.name)

        readme_map = {}
        for library_name, (markdown_hash, _, selected_name) in selected_readmes.items():
            readme_map[library_name] = markdown_hash
            hashes = seen_hashes.get(library_name, set())
            if len(hashes) > 1:
                logger.warning(
                    "Multiple README files found for library '%s' in %s; "
                    "selected '%s' with hash '%s'. "
                    "Available hashes: %s",
                    library_name,
                    version,
                    selected_name,
                    markdown_hash,
                    sorted(hashes),
                )

        return readme_map

    def load_library_readme_content(self, version: Version, library_name: str, markdown_hash: str) -> str | None:
        """
        Load the content of a specific library README.

        Args:
            version: Version to load from
            library_name: Name of the library
            markdown_hash: Content hash of the markdown

        Returns:
            The markdown content, or None if it doesn't exist or cannot be read
        """
        safe_name = self._sanitize_name(library_name)
        file_path = self.get_version_dir(version) / self.README_DIR / f"{safe_name}-{markdown_hash}.md"
        if not file_path.exists():
            return None

        try:
            return file_path.read_text(encoding="utf-8")
        except OSError as e:
            logger.error("Failed to read README file '%s': %s", file_path, e)
            return None

    def _parse_readme_filename(self, filename: str) -> tuple[str, str] | None:
        """
        Parse a README filename into (library_name, markdown_hash).
        Format: {library-name}-{hash}.md
        """
        match = re.match(r"^(.+)-([a-f0-9]{12})\.md$", filename)
        if match:
            return match.group(1), match.group(2)
        return None


@dataclass(frozen=True)
class SnapshotRecord:
    """Record describing an imported report snapshot in the inventory."""

    id: str
    content_digest: str
    source_repository: str
    source_revision: str
    upstream_schema_version: int
    target_count: int
    path: str
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert record to dictionary for index serialization."""
        data = {
            "id": self.id,
            "content_digest": self.content_digest,
            "source_repository": self.source_repository,
            "source_revision": self.source_revision,
            "upstream_schema_version": self.upstream_schema_version,
            "target_count": self.target_count,
            "path": self.path,
        }
        if self.extra:
            data.update(self.extra)
        return data


class SnapshotInventoryManager:
    """Manages content- and commit-addressed snapshot inventories.

    Directory structure:
        inventory_dir/
            index.yaml
            current.yaml
            snapshots/
                <snapshot-id>/
                    envelope.yaml
                    report.json
                    targets.yaml
    """

    INDEX_FILE = "index.yaml"
    CURRENT_FILE = "current.yaml"
    SNAPSHOTS_DIR = "snapshots"

    def __init__(self, inventory_dir: str | Path):
        self.inventory_dir = Path(inventory_dir)
        self.snapshots_dir = self.inventory_dir / self.SNAPSHOTS_DIR
        self.index_file = self.inventory_dir / self.INDEX_FILE
        self.current_file = self.inventory_dir / self.CURRENT_FILE

    def get_snapshot_dir(self, snapshot_id: str) -> Path:
        """Get directory path for a specific snapshot ID."""
        return self.snapshots_dir / snapshot_id

    def snapshot_exists(self, snapshot_id: str) -> bool:
        """Check if snapshot directory exists and contains basic artifacts."""
        snap_dir = self.get_snapshot_dir(snapshot_id)
        return snap_dir.exists() and (snap_dir / "report.json").exists() and (snap_dir / "envelope.yaml").exists()

    def load_index(self) -> dict[str, Any]:
        """Load index.yaml or return a default empty index."""
        if not self.index_file.exists():
            return {
                "schema_version": "1.0.0",
                "current_snapshot_id": None,
                "snapshots": [],
            }
        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            if not isinstance(data, dict):
                return {
                    "schema_version": "1.0.0",
                    "current_snapshot_id": None,
                    "snapshots": [],
                }
            if "snapshots" not in data or not isinstance(data["snapshots"], list):
                data["snapshots"] = []
            return data
        except OSError as e:
            logger.error("Failed to read %s: %s", self.index_file, e)
            return {
                "schema_version": "1.0.0",
                "current_snapshot_id": None,
                "snapshots": [],
            }

    def save_index(self, index_data: dict[str, Any]) -> None:
        """Save index.yaml atomically."""
        self.inventory_dir.mkdir(parents=True, exist_ok=True)
        tmp_file = self.inventory_dir / f".{self.INDEX_FILE}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            yaml.safe_dump(index_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
        tmp_file.replace(self.index_file)

    def get_current_snapshot(self) -> dict[str, Any] | None:
        """Load current.yaml pointer if present."""
        if not self.current_file.exists():
            return None
        try:
            with open(self.current_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return data if isinstance(data, dict) else None
        except OSError as e:
            logger.error("Failed to read %s: %s", self.current_file, e)
            return None

    def save_current(self, current_data: dict[str, Any]) -> None:
        """Save current.yaml atomically."""
        self.inventory_dir.mkdir(parents=True, exist_ok=True)
        tmp_file = self.inventory_dir / f".{self.CURRENT_FILE}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            yaml.safe_dump(current_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
        tmp_file.replace(self.current_file)

    def has_digest(self, content_digest: str) -> bool:
        """Check if an identical report content digest has already been registered in the index."""
        index = self.load_index()
        for snap in index.get("snapshots", []):
            if snap.get("content_digest") == content_digest:
                return True
        return False

    def get_snapshot_by_id(self, snapshot_id: str) -> dict[str, Any] | None:
        """Find a snapshot record by ID from the index."""
        index = self.load_index()
        for snap in index.get("snapshots", []):
            if snap.get("id") == snapshot_id:
                return snap
        return None

    def list_snapshots(self) -> list[dict[str, Any]]:
        """List all snapshots from the index."""
        index = self.load_index()
        return list(index.get("snapshots", []))

    def register_snapshot(self, record: SnapshotRecord, set_as_current: bool = True) -> None:
        """Register snapshot in index.yaml and optionally update current.yaml."""
        index = self.load_index()
        snapshots = index.get("snapshots", [])

        updated = False
        record_dict = record.to_dict()
        for i, snap in enumerate(snapshots):
            if snap.get("id") == record.id:
                snapshots[i] = record_dict
                updated = True
                break
        if not updated:
            snapshots.append(record_dict)

        if set_as_current:
            index["current_snapshot_id"] = record.id

        index["snapshots"] = snapshots
        self.save_index(index)

        if set_as_current:
            current_data = {
                "snapshot_id": record.id,
                "path": record.path,
                "content_digest": record.content_digest,
                "source_repository": record.source_repository,
                "source_revision": record.source_revision,
            }
            self.save_current(current_data)
