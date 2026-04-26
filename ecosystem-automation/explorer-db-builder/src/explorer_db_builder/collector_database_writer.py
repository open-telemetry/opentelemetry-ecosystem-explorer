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
"""Writes collector data to content-addressed file storage."""

import json
import logging
import shutil
from pathlib import Path
from typing import Any

from semantic_version import Version

from explorer_db_builder.collector_transformer import COMPONENT_TYPES, make_index_component
from explorer_db_builder.content_hashing import content_hash

logger = logging.getLogger(__name__)


class CollectorDatabaseWriter:
    """Manages writing collector component data to a content-addressed file system database."""

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/collector") -> None:
        self.database_dir = Path(database_dir)
        self.files_written = 0
        self.total_bytes = 0

    def _write_json(self, path: Path, data: Any) -> None:
        content = json.dumps(data, indent=2, sort_keys=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        self.files_written += 1
        self.total_bytes += len(content.encode("utf-8"))

    def _get_component_path(self, component_id: str, component_hash: str) -> Path:
        component_dir = self.database_dir / "components" / component_id
        component_dir.mkdir(parents=True, exist_ok=True)
        return component_dir / f"{component_id}-{component_hash}.json"

    def write_components(self, components: list[dict[str, Any]]) -> dict[str, str]:
        """Write component data to content-addressed files.

        Args:
            components: List of canonical component dicts, each with an "id" field.

        Returns:
            Dict mapping component id to content hash.

        Raises:
            ValueError: If components list is empty or all items are invalid.
        """
        if not components:
            raise ValueError("Components list cannot be empty")

        component_map: dict[str, str] = {}

        for idx, component in enumerate(components):
            if not isinstance(component, dict):
                logger.warning("Skipping component at index %d: not a dictionary", idx)
                continue

            component_id = component.get("id")
            if not component_id:
                logger.warning("Skipping component at index %d: missing 'id' field", idx)
                continue

            try:
                comp_hash = content_hash(component)
                file_path = self._get_component_path(component_id, comp_hash)

                if file_path.exists():
                    logger.debug("Component '%s' hash %s already exists, skipping", component_id, comp_hash)
                else:
                    self._write_json(file_path, component)
                    logger.debug("Wrote component '%s' hash %s", component_id, comp_hash)

                component_map[component_id] = comp_hash

            except (TypeError, ValueError) as e:
                logger.error("Failed to hash component '%s': %s", component_id, e, exc_info=True)
                continue
            except OSError as e:
                logger.error("Failed to write component '%s': %s", component_id, e, exc_info=True)
                continue

        if not component_map:
            raise ValueError("No valid components were processed")

        return component_map

    def write_version_index(self, version: Version, component_map: dict[str, str]) -> None:
        """Write a version manifest mapping component ids to their content hashes.

        Args:
            version: The semantic version being recorded.
            component_map: Dict of {component_id: hash}.

        Raises:
            ValueError: If component_map is empty.
        """
        if not component_map:
            raise ValueError("Component map cannot be empty")

        versions_dir = self.database_dir / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)

        version_file = versions_dir / f"{version}-index.json"
        version_data = {"version": str(version), "components": component_map}

        try:
            self._write_json(version_file, version_data)
            logger.info("Wrote collector version index for %s with %d components", version, len(component_map))
        except OSError as e:
            logger.error("Failed to write version index for %s: %s", version, e)
            raise

    def write_version_list(self, versions: list[Version]) -> None:
        """Write the top-level versions-index.json listing all available versions.

        Args:
            versions: Sorted list of versions, latest first.

        Raises:
            ValueError: If versions list is empty.
        """
        if not versions:
            raise ValueError("Versions list cannot be empty")

        self.database_dir.mkdir(parents=True, exist_ok=True)

        version_list = [{"version": str(v), "is_latest": v == versions[0]} for v in versions]
        versions_file = self.database_dir / "versions-index.json"

        try:
            self._write_json(versions_file, {"versions": version_list})
            logger.info("Wrote collector versions-index with %d versions (latest: %s)", len(versions), versions[0])
        except OSError as e:
            logger.error("Failed to write versions-index: %s", e)
            raise

    def write_index(self, latest_components: list[dict[str, Any]]) -> None:
        """Write the per-ecosystem index.json with taxonomy and lightweight component list.

        Derives the taxonomy (distributions, types) from what is actually present in the data.

        Args:
            latest_components: Full canonical component dicts from the latest release version.
        """
        self.database_dir.mkdir(parents=True, exist_ok=True)

        distributions_seen: list[str] = []
        types_seen: list[str] = []
        for component in latest_components:
            dist = component.get("distribution", "")
            ctype = component.get("type", "")
            if dist and dist not in distributions_seen:
                distributions_seen.append(dist)
            if ctype and ctype not in types_seen:
                types_seen.append(ctype)

        # Preserve a stable order: distributions sorted, types in canonical order
        distributions_sorted = sorted(distributions_seen)
        types_ordered = [t for t in COMPONENT_TYPES if t in types_seen]

        index_data: dict[str, Any] = {
            "ecosystem": "collector",
            "taxonomy": {
                "distributions": distributions_sorted,
                "types": types_ordered,
            },
            "components": [make_index_component(c) for c in latest_components],
        }

        index_file = self.database_dir / "index.json"
        try:
            self._write_json(index_file, index_data)
            logger.info(
                "Wrote collector index with %d components (distributions: %s, types: %s)",
                len(latest_components),
                distributions_sorted,
                types_ordered,
            )
        except OSError as e:
            logger.error("Failed to write index.json: %s", e)
            raise

    def get_stats(self) -> dict[str, Any]:
        return {"files_written": self.files_written, "total_bytes": self.total_bytes}

    def clean(self) -> None:
        """Remove the collector database directory and recreate it empty."""
        if self.database_dir.exists():
            logger.info("Cleaning collector database directory: %s", self.database_dir)
            shutil.rmtree(self.database_dir)
            logger.info("Collector database directory cleaned")
        self.database_dir.mkdir(parents=True, exist_ok=True)
