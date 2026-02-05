"""Writes data to content-addressed file storage database."""

import json
import logging
import shutil
from pathlib import Path
from typing import Any

from semantic_version import Version

from explorer_db_builder.content_hashing import content_hash

logger = logging.getLogger(__name__)


class DatabaseWriter:
    """Manages writing data to a content-addressed file system database.

    The database organizes data using content hashing to avoid duplication
    and enable efficient versioning. Files are written to a specific directory
    structure with instrumentations stored by name and hash.
    """

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/javaagent") -> None:
        """Initialize the database writer.

        Args:
            database_dir: Root directory for the database files.
                         Defaults to the ecosystem-explorer public data directory.
        """
        self.database_dir = Path(database_dir)
        self.files_written = 0
        self.total_bytes = 0

    def _get_file_path(self, library_name: str, library_hash: str) -> Path:
        """Get the file path for a library with the given name and hash.

        Creates the directory structure if it doesn't exist.

        Args:
            library_name: Name of the library/instrumentation
            library_hash: Content hash of the library data

        Returns:
            Path to the library JSON file
        """
        instrumentations_dir = self.database_dir / "instrumentations" / library_name
        instrumentations_dir.mkdir(parents=True, exist_ok=True)
        return instrumentations_dir / f"{library_name}-{library_hash}.json"

    def write_libraries(self, libraries: list[dict[str, Any]]) -> dict[str, str]:
        """Write library data to content-addressed files.

        Each library is hashed and written to a file named with its hash.
        If a library with the same hash already exists, it's not rewritten.

        Args:
            libraries: List of library/instrumentation dictionaries.
                      Each must have a "name" field.

        Returns:
            Dictionary mapping library names to their content hashes

        Raises:
            ValueError: If libraries list is empty or contains invalid data
        """
        if not libraries:
            raise ValueError("Libraries list cannot be empty")

        library_map: dict[str, str] = {}

        for idx, library in enumerate(libraries):
            if not isinstance(library, dict):
                logger.warning(f"Skipping library at index {idx}: not a dictionary")
                continue

            if "name" not in library:
                logger.warning(f"Skipping library at index {idx}: missing 'name' field")
                continue

            library_name = library["name"]

            try:
                library_hash = content_hash(library)
                file_path = self._get_file_path(library_name, library_hash)

                if file_path.exists():
                    logger.debug(f"Library '{library_name}' with hash {library_hash} already exists, skipping write")
                else:
                    content = json.dumps(library, indent=2, sort_keys=True)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    file_size = len(content.encode("utf-8"))
                    self.files_written += 1
                    self.total_bytes += file_size
                    logger.debug(f"Wrote library '{library_name}' with hash {library_hash}")

                library_map[library_name] = library_hash

            except (TypeError, ValueError) as e:
                logger.error(f"Failed to hash library '{library_name}': {e}", exc_info=True)
                continue
            except OSError as e:
                logger.error(f"Failed to write library '{library_name}': {e}", exc_info=True)
                continue

        if not library_map:
            raise ValueError("No valid libraries were processed")

        return library_map

    def write_version_index(self, version: Version, library_map: dict[str, str]) -> None:
        """Write version index mapping library names to content hashes.

        Creates an index file for a specific version that maps library names
        to their content hashes, enabling version-specific lookups.

        Args:
            version: The semantic version to write the index for
            library_map: Dictionary mapping library names to content hashes

        Raises:
            ValueError: If library_map is empty
            OSError: If file writing fails
        """
        if not library_map:
            raise ValueError("Library map cannot be empty")

        versions_dir = self.database_dir / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)

        version_file = versions_dir / f"{version}-index.json"
        version_data = {"version": str(version), "instrumentations": library_map}

        try:
            content = json.dumps(version_data, indent=2, sort_keys=True)
            with open(version_file, "w", encoding="utf-8") as f:
                f.write(content)
            file_size = len(content.encode("utf-8"))
            self.files_written += 1
            self.total_bytes += file_size
            logger.info(f"Wrote version index for {version} with {len(library_map)} instrumentations")
        except OSError as e:
            logger.error(f"Failed to write version index for {version}: {e}")
            raise

    def write_version_list(self, versions: list[Version]) -> None:
        """Write the master version list index.

        Creates a top-level index file listing all available versions,
        with the first version marked as the latest.

        Args:
            versions: List of semantic versions, should be sorted with
                     latest first

        Raises:
            ValueError: If versions list is empty
            OSError: If file writing fails
        """
        if not versions:
            raise ValueError("Versions list cannot be empty")

        self.database_dir.mkdir(parents=True, exist_ok=True)

        version_list_file = self.database_dir / "versions-index.json"
        version_list_data: list[dict[str, Any]] = []

        for version in versions:
            version_list_data.append({"version": str(version), "is_latest": version == versions[0]})

        final_data = {"versions": version_list_data}

        try:
            content = json.dumps(final_data, indent=2, sort_keys=True)
            with open(version_list_file, "w", encoding="utf-8") as f:
                f.write(content)
            file_size = len(content.encode("utf-8"))
            self.files_written += 1
            self.total_bytes += file_size
            logger.info(f"Wrote version list with {len(versions)} versions (latest: {versions[0]})")
        except OSError as e:
            logger.error(f"Failed to write version list: {e}")
            raise

    def get_stats(self) -> dict[str, Any]:
        """Get statistics about files written during this session.

        Returns:
            Dictionary with 'files_written' (int) and 'total_bytes' (int)
        """
        return {"files_written": self.files_written, "total_bytes": self.total_bytes}

    def clean(self) -> None:
        """Remove all files in the database directory.

        This completely removes the database directory and recreates it empty.

        Raises:
            OSError: If directory removal or creation fails
        """
        if self.database_dir.exists():
            logger.info(f"Cleaning database directory: {self.database_dir}")
            shutil.rmtree(self.database_dir)
            logger.info("Database directory cleaned")

        self.database_dir.mkdir(parents=True, exist_ok=True)
