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
