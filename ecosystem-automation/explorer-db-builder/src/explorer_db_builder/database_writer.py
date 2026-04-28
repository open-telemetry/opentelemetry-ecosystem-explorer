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
    structure with components stored by name and hash.
    """

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/javaagent") -> None:
        """Initialize the database writer.

        Args:
            database_dir: Root directory for the database files.
        """
        self.database_dir = Path(database_dir)
        self.files_written = 0
        self.total_bytes = 0

    def _get_file_path(self, component_name: str, component_hash: str, sub_dir: str = "instrumentations") -> Path:
        """Get the file path for a component with the given name and hash.

        Creates the directory structure if it doesn't exist.

        Args:
            component_name: Name of the component
            component_hash: Content hash of the component data
            sub_dir: Subdirectory to store components in (default: instrumentations)

        Returns:
            Path to the component JSON file
        """
        components_dir = self.database_dir / sub_dir / component_name
        components_dir.mkdir(parents=True, exist_ok=True)
        return components_dir / f"{component_name}-{component_hash}.json"

    def write_components(self, components: list[dict[str, Any]], sub_dir: str = "instrumentations") -> dict[str, str]:
        """Write component data to content-addressed files.

        Each component is hashed and written to a file named with its hash.
        If a component with the same hash already exists, it's not rewritten.

        Args:
            components: List of component dictionaries.
                       Each must have a "name" field.
            sub_dir: Subdirectory to store components in.

        Returns:
            Dictionary mapping component names to their content hashes

        Raises:
            ValueError: If components list is empty or contains invalid data
        """
        if not components:
            raise ValueError("Libraries list cannot be empty")

        component_map: dict[str, str] = {}

        for idx, component in enumerate(components):
            if not isinstance(component, dict):
                logger.warning(f"Skipping component at index {idx}: not a dictionary")
                continue

            if "name" not in component:
                logger.warning(f"Skipping component at index {idx}: missing 'name' field")
                continue

            component_name = component["name"]

            try:
                component_hash = content_hash(component)
                file_path = self._get_file_path(component_name, component_hash, sub_dir)

                if file_path.exists():
                    logger.debug(
                        f"Component '{component_name}' with hash {component_hash} already exists, skipping write"
                    )
                else:
                    content = json.dumps(component, indent=2, sort_keys=True)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    file_size = len(content.encode("utf-8"))
                    self.files_written += 1
                    self.total_bytes += file_size
                    logger.debug(f"Wrote component '{component_name}' with hash {component_hash}")

                component_map[component_name] = component_hash

            except (TypeError, ValueError) as e:
                logger.error(f"Failed to hash component '{component_name}': {e}", exc_info=True)
                continue
            except OSError as e:
                logger.error(f"Failed to write component '{component_name}': {e}", exc_info=True)
                continue

        if not component_map:
            raise ValueError("No valid libraries were processed")

        return component_map

    def write_version_index(
        self, version: Version, component_map: dict[str, str], index_key: str = "instrumentations"
    ) -> None:
        """Write version index mapping component names to content hashes.

        Creates an index file for a specific version that maps component names
        to their content hashes, enabling version-specific lookups.

        Args:
            version: The semantic version to write the index for
            component_map: Dictionary mapping component names to content hashes
            index_key: The key to use in the index JSON for the component map.

        Raises:
            ValueError: If component_map is empty
            OSError: If file writing fails
        """
        if not component_map:
            raise ValueError("Library map cannot be empty")

        versions_dir = self.database_dir / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)

        version_file = versions_dir / f"{version}-index.json"
        version_data = {"version": str(version), index_key: component_map}

        try:
            content = json.dumps(version_data, indent=2, sort_keys=True)
            with open(version_file, "w", encoding="utf-8") as f:
                f.write(content)
            file_size = len(content.encode("utf-8"))
            self.files_written += 1
            self.total_bytes += file_size
            logger.info(f"Wrote version index for {version} with {len(component_map)} components")
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

    def write_libraries(self, libraries: list[dict[str, Any]]) -> dict[str, str]:
        """Backward compatibility alias for write_components."""
        return self.write_components(libraries, sub_dir="instrumentations")

    def write_instrumentation_index(self, version: Version, library_map: dict[str, str]) -> None:
        """Backward compatibility alias for write_version_index."""
        return self.write_version_index(version, library_map, index_key="libraries")

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
