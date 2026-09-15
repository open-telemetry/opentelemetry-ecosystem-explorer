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

import json
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
    SYNC_STATE_FILE = "readme-sync-state.json"
    MAX_README_FETCH_ATTEMPTS = 3

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

    # --- README sync state (readme-sync-state.json) ---

    def _load_readme_sync_state(self) -> dict[str, Any]:
        """Load the README sync state from readme-sync-state.json.

        The file is git-tracked and persists between CI runs.
        Returns an empty dict if the file does not exist or cannot be parsed.
        """
        path = self.inventory_dir / self.SYNC_STATE_FILE
        if not path.exists():
            return {}
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError) as e:
            logger.warning("Failed to load readme sync state: %s", e)
            return {}

    def _save_readme_sync_state(self, state: dict[str, Any]) -> None:
        """Persist the README sync state to readme-sync-state.json.

        Uses sort_keys=True and a trailing newline so diffs are deterministic
        (AGENTS.md requirement).
        """
        path = self.inventory_dir / self.SYNC_STATE_FILE
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2, sort_keys=True)
                f.write("\n")
        except OSError as e:
            logger.error("Failed to save readme sync state: %s", e)

    def readmes_synced(self, version: Version) -> bool:
        """Return True if READMEs have been fully synced for this version.

        Reads from readme-sync-state.json (not instrumentation.yaml).
        """
        return bool(self._load_readme_sync_state().get(str(version), {}).get("synced", False))

    def get_readme_failures(self, version: Version) -> dict[str, int]:
        """Return per-library failure counts for the given version.

        Returns an empty dict if no failures have been recorded.
        """
        state = self._load_readme_sync_state()
        return state.get(str(version), {}).get("failed", {})

    def record_readme_sync(self, version: Version, failed: dict[str, int]) -> None:
        """Record sync results for a version.

        Args:
            version: Version that was synced
            failed: mapping of library name -> consecutive failed fetch attempts.

        A version is considered synced once every remaining failure has exhausted
        its retries (MAX_README_FETCH_ATTEMPTS). Libraries that have been given up
        on are not retryable and do not block the "synced" flag.
        """
        retryable = {name: count for name, count in failed.items() if count < self.MAX_README_FETCH_ATTEMPTS}
        synced = not retryable

        state = self._load_readme_sync_state()
        state[str(version)] = {"synced": synced, "failed": failed}
        self._save_readme_sync_state(state)

    # --- README file storage ---

    def _sanitize_name(self, name: str) -> str:
        """Sanitizes a name for use as a filename to prevent path traversal."""
        return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)

    def save_library_readmes(
        self,
        readmes: Iterable[tuple[str, str]],  # (library_name, content)
    ) -> dict[str, str]:
        """Write each README content-addressed to the global library_readmes/ dir.

        Args:
            readmes: Iterable of (library_name, markdown_content) pairs.

        Returns:
            Mapping of library_name -> filename for every README processed
            (whether newly written or already present).
        """
        target_dir = self.inventory_dir / self.README_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        written: dict[str, str] = {}
        for name, content in readmes:
            digest = compute_content_hash(content)
            safe_name = self._sanitize_name(name)
            filename = f"{safe_name}-{digest}.md"
            file_path = target_dir / filename
            if not file_path.exists():
                file_path.write_text(content, encoding="utf-8")
            written[name] = filename
        return written

    def _readme_map_from_yaml(self, version: Version) -> dict[str, str]:
        """Build a map of library_name -> markdown_hash by reading the 'readme'
        field from the version's instrumentation.yaml.

        Returns an empty dict if no library has a 'readme' field (pre-#883 state).
        Keys are the *raw* library names as stored in the YAML (not sanitized).
        """
        data = self.load_versioned_inventory(version)
        libraries_raw = data.get("libraries", [])
        if isinstance(libraries_raw, dict):
            libraries = [lib for group in libraries_raw.values() for lib in group]
        else:
            libraries = libraries_raw

        readme_map: dict[str, str] = {}
        for lib in libraries:
            readme_file = lib.get("readme")
            if readme_file:
                parsed = self._parse_readme_filename(readme_file)
                if parsed:
                    _, markdown_hash = parsed
                    # Use the raw name so callers can look it up by item["name"].
                    readme_map[lib["name"]] = markdown_hash
                else:
                    logger.warning(
                        "Malformed README filename '%s' for library '%s' in version %s – skipping.",
                        readme_file,
                        lib.get("name", "<unknown>"),
                        version,
                    )
        return readme_map

    def _legacy_readme_map(self, version: Version) -> dict[str, str]:
        """Fallback for pre-#883 versions: build a map of library_name -> markdown_hash
        by scanning the per-version library_readmes directory on disk.

        Tie-break on sorted filename when multiple files exist for the same name.
        Remove with the per-version library_readmes/ dirs once every version is
        migrated.

        Note: Keys here are *sanitized* names recovered from filenames, unlike
        _readme_map_from_yaml which keys by the raw name. Equivalent for all 261
        current Java library names; would diverge for any name containing a character
        outside [a-zA-Z0-9._-]. Goes away with the legacy dirs.
        """
        version_readme_dir = self.get_version_dir(version) / self.README_DIR
        if not version_readme_dir.exists():
            return {}

        readme_map: dict[str, str] = {}
        # Sort filenames for a deterministic tie-break order.
        for item in sorted(version_readme_dir.iterdir()):
            if not (item.is_file() and item.suffix == ".md"):
                continue
            parsed = self._parse_readme_filename(item.name)
            if parsed:
                name, markdown_hash = parsed
                readme_map[name] = markdown_hash
            else:
                logger.warning("Malformed README filename in %s: %s", version, item.name)
        return readme_map

    def load_library_readme_map(self, version: Version) -> dict[str, str]:
        """Build a map of library_name -> markdown_hash for a given version.

        Merges the legacy per-version directory scan with the new YAML-backed
        lookup (YAML wins on conflict). This handles the partially-migrated case
        where some libraries have 'readme:' refs and others only have files in
        the old v{version}/library_readmes/ directory.

        Remove the merge / legacy branch after every version has been migrated.

        Args:
            version: Version to scan

        Returns:
            Dictionary mapping library names to their markdown content hashes
        """
        readme_map = self._legacy_readme_map(version)
        readme_map.update(self._readme_map_from_yaml(version))
        return readme_map

    def load_library_readme_content(self, version: Version, library_name: str, markdown_hash: str) -> str | None:
        """Load the content of a specific library README.

        Tries the global library_readmes/ directory first (post-#883 location),
        then falls back to the per-version v{version}/library_readmes/ directory
        for pre-#883 versions. Remove the fallback after migrating all versions.

        Args:
            version: Version to load from (used only for the legacy fallback path)
            library_name: Name of the library
            markdown_hash: Content hash of the markdown

        Returns:
            The markdown content, or None if it doesn't exist or cannot be read
        """
        safe_name = self._sanitize_name(library_name)
        filename = f"{safe_name}-{markdown_hash}.md"

        # Try global directory first (post-#883).
        global_path = self.inventory_dir / self.README_DIR / filename
        if global_path.exists():
            try:
                return global_path.read_text(encoding="utf-8")
            except OSError as e:
                logger.error("Failed to read README file '%s': %s", global_path, e)
                return None

        # Fallback: per-version directory (pre-#883 legacy location).
        # Remove once every version has been migrated.
        legacy_path = self.get_version_dir(version) / self.README_DIR / filename
        if legacy_path.exists():
            try:
                return legacy_path.read_text(encoding="utf-8")
            except OSError as e:
                logger.error("Failed to read README file '%s': %s", legacy_path, e)
                return None

        return None

    def prune_orphan_readmes(self) -> int:
        """Delete README files in the global library_readmes/ dir that are no
        longer referenced by any version's instrumentation.yaml.

        Safety: returns 0 without touching anything if no version references any
        README (i.e., during the pre-migration period before any 'readme:' refs
        have been written). Only walks the 'libraries' key, not 'custom'.

        Returns:
            Number of files deleted.
        """
        global_readme_dir = self.inventory_dir / self.README_DIR
        if not global_readme_dir.exists():
            return 0

        # Collect all filenames referenced by any version.
        referenced_files: set[str] = set()
        for version in self.list_versions():
            data = self.load_versioned_inventory(version)
            libraries_raw = data.get("libraries", [])
            if isinstance(libraries_raw, dict):
                libraries = [lib for group in libraries_raw.values() for lib in group]
            else:
                libraries = libraries_raw or []
            for lib in libraries:
                readme_file = lib.get("readme")
                if readme_file:
                    referenced_files.add(readme_file)

        # Safety: if nothing references any file yet, skip pruning entirely.
        if not referenced_files:
            return 0

        pruned = 0
        for item in list(global_readme_dir.iterdir()):
            if item.is_file() and item.suffix == ".md" and item.name not in referenced_files:
                try:
                    item.unlink()
                    pruned += 1
                    logger.info("Pruned orphaned README: %s", item.name)
                except OSError as e:
                    logger.warning("Failed to prune README '%s': %s", item.name, e)

        return pruned

    def _parse_readme_filename(self, filename: str) -> tuple[str, str] | None:
        """
        Parse a README filename into (library_name, markdown_hash).
        Format: {library-name}-{hash}.md
        """
        match = re.match(r"^(.+)-([a-f0-9]{12})\.md$", filename)
        if match:
            return match.group(1), match.group(2)
        return None
