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
"""Inventory management for component tracking."""

import logging
import re
import shutil
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version
from watcher_common.content_hashing import compute_content_hash

from .type_defs import COMPONENT_TYPES, DistributionName

logger = logging.getLogger(__name__)


class InventoryManager:
    """Manages component inventory storage and retrieval."""

    README_DIR = "component_readmes"

    def __init__(self, inventory_dir: str = "ecosystem-registry/collector"):
        """
        Args:
            inventory_dir: Base directory for versioned metadata
        """
        self.inventory_dir = Path(inventory_dir)

    def get_version_dir(self, distribution: DistributionName, version: Version) -> Path:
        """
        Get the directory path for a specific distribution and version.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version object

        Returns:
            Path to version directory (with 'v' prefix)
        """
        return self.inventory_dir / distribution / f"v{version}"

    def meta_schemas_dir(self) -> Path:
        """
        Return the content-addressable schema storage directory.

        The schema is stored once per distinct content as ``{hash}.yaml``,
        not once per version. A component YAML's ``schema_hash`` field
        directly identifies its schema file at
        ``meta_schemas_dir() / f"{schema_hash}.yaml"``.
        """
        return self.inventory_dir / "meta" / "schemas"

    def prune_orphan_schemas(self) -> int:
        """
        Delete schema files in ``meta/schemas/`` no longer referenced by any
        component YAML.

        Walks every distribution's version directories, collects the set of
        ``schema_hash`` values referenced by component YAMLs, then removes any
        ``meta/schemas/{hash}.yaml`` whose hash is not in that set. Should be
        called after deleting a version (release backfill, snapshot cleanup)
        to reclaim files that lost their last reference.

        Returns:
            Number of orphan schema files deleted.
        """
        schemas_dir = self.meta_schemas_dir()
        if not schemas_dir.exists():
            return 0

        referenced: set[str] = set()
        if self.inventory_dir.exists():
            for dist_dir in self.inventory_dir.iterdir():
                if not dist_dir.is_dir() or dist_dir.name == "meta":
                    continue
                for version_dir in dist_dir.iterdir():
                    if not version_dir.is_dir():
                        continue
                    for component_file in version_dir.glob("*.yaml"):
                        try:
                            with open(component_file, encoding="utf-8") as f:
                                data = yaml.safe_load(f) or {}
                        except yaml.YAMLError:
                            continue
                        schema_hash = data.get("schema_hash")
                        if schema_hash and schema_hash != "unknown":
                            referenced.add(schema_hash)

        removed = 0
        for stored in schemas_dir.glob("*.yaml"):
            if stored.stem not in referenced:
                stored.unlink()
                removed += 1

        return removed

    def save_versioned_inventory(
        self,
        distribution: DistributionName,
        version: Version,
        components: dict[str, list[dict[str, Any]]],
        repository: str,
        schema_hash: str = "unknown",
    ) -> None:
        """
        Save inventory for a specific distribution and version.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version object
            components: Dictionary of component type to component list
            repository: Name of the repository being scanned
            schema_hash: 12-char hex hash of metadata-schema.yaml at scan time,
                         or "unknown" when the schema file was absent in the repo
        """
        version_dir = self.get_version_dir(distribution, version)
        version_dir.mkdir(parents=True, exist_ok=True)

        for component_type in COMPONENT_TYPES:
            component_list = components.get(component_type, [])
            file_path = version_dir / f"{component_type}.yaml"

            component_data = {
                "distribution": distribution,
                "version": str(version),
                "repository": repository,
                "component_type": component_type,
                "schema_hash": schema_hash,
                "components": component_list,
            }

            with open(file_path, "w", encoding="utf-8") as f:
                yaml.dump(component_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    def load_versioned_inventory(self, distribution: DistributionName, version: Version) -> dict[str, Any]:
        """
        Load inventory for a specific distribution and version.

        Args:
            distribution: Distribution name
            version: Version object

        Returns:
            Inventory dictionary with all components, or empty structure if it doesn't exist.
            Includes schema_hash field (defaults to "unknown" for files written before
            schema fingerprinting was introduced).
        """
        version_dir = self.get_version_dir(distribution, version)

        if not version_dir.exists():
            return {"distribution": distribution, "version": str(version), "schema_hash": "unknown", "components": {}}

        components = {}
        repository = ""
        schema_hash = "unknown"

        for component_type in COMPONENT_TYPES:
            file_path = version_dir / f"{component_type}.yaml"

            if file_path.exists():
                with open(file_path, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                    components[component_type] = data.get("components", [])
                    if not repository:
                        repository = data.get("repository", "")
                    if schema_hash == "unknown":
                        schema_hash = data.get("schema_hash", "unknown")
            else:
                components[component_type] = []

        return {
            "distribution": distribution,
            "version": str(version),
            "repository": repository,
            "schema_hash": schema_hash,
            "components": components,
        }

    def readme_dir_exists(self, distribution: DistributionName, version: Version) -> bool:
        """Return True if the component_readmes directory exists for this distribution/version."""
        return (self.get_version_dir(distribution, version) / self.README_DIR).exists()

    def _sanitize_name(self, name: str) -> str:
        """Sanitizes a name for use as a filename to prevent path traversal."""
        return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)

    def save_component_readmes(
        self,
        distribution: DistributionName,
        version: Version,
        readmes: Iterable[tuple[str, str]],  # (component_name, content)
    ) -> int:
        """
        Write each README content-addressed. Returns count newly written.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version object
            readmes: Iterable of (component_name, content) pairs, e.g. from
                     readme_scanner.discover_component_readmes()

        Returns:
            Number of README files newly written (existing content-addressed
            files are left untouched, matching save_versioned_inventory's
            general approach of not rewriting unchanged data).
        """
        target_dir = self.get_version_dir(distribution, version) / self.README_DIR
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

    def load_component_readme_map(self, distribution: DistributionName, version: Version) -> dict[str, str]:
        """
        Scan component_readmes/ and build a map of sanitized component_name -> markdown_hash.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version to scan

        Returns:
            Dictionary mapping sanitized component names to their markdown content hashes
        """
        readme_dir = self.get_version_dir(distribution, version) / self.README_DIR
        if not readme_dir.exists():
            return {}

        selected_readmes: dict[str, tuple[str, int, str]] = {}
        seen_hashes: dict[str, set[str]] = {}

        for item in sorted(readme_dir.iterdir(), key=lambda p: p.name):
            if item.is_file() and item.suffix == ".md":
                parsed = self._parse_readme_filename(item.name)
                if parsed:
                    component_name, markdown_hash = parsed
                    seen_hashes.setdefault(component_name, set()).add(markdown_hash)

                    try:
                        mtime_ns = item.stat().st_mtime_ns
                    except OSError:
                        logger.warning("Failed to stat README file in %s %s: %s", distribution, version, item.name)
                        continue

                    current = selected_readmes.get(component_name)
                    if current is None:
                        selected_readmes[component_name] = (markdown_hash, mtime_ns, item.name)
                    else:
                        _, current_mtime_ns, current_name = current
                        if mtime_ns > current_mtime_ns or (mtime_ns == current_mtime_ns and item.name > current_name):
                            selected_readmes[component_name] = (markdown_hash, mtime_ns, item.name)
                else:
                    logger.warning("Malformed README filename in %s %s: %s", distribution, version, item.name)

        readme_map = {}
        for component_name, (markdown_hash, _, selected_name) in selected_readmes.items():
            readme_map[component_name] = markdown_hash
            hashes = seen_hashes.get(component_name, set())
            if len(hashes) > 1:
                logger.warning(
                    "Multiple README files found for component '%s' in %s %s; "
                    "selected '%s' with hash '%s'. Available hashes: %s",
                    component_name,
                    distribution,
                    version,
                    selected_name,
                    markdown_hash,
                    sorted(hashes),
                )

        return readme_map

    def load_component_readme_content(
        self, distribution: DistributionName, version: Version, component_name: str, markdown_hash: str
    ) -> str | None:
        """
        Load the content of a specific component README.

        Args:
            distribution: Distribution name (core or contrib)
            version: Version to load from
            component_name: Name of the component
            markdown_hash: Content hash of the markdown

        Returns:
            The markdown content, or None if it doesn't exist or cannot be read
        """
        safe_name = self._sanitize_name(component_name)
        file_path = self.get_version_dir(distribution, version) / self.README_DIR / f"{safe_name}-{markdown_hash}.md"
        if not file_path.exists():
            return None

        try:
            return file_path.read_text(encoding="utf-8")
        except OSError as e:
            logger.error("Failed to read README file '%s': %s", file_path, e)
            return None

    def _parse_readme_filename(self, filename: str) -> tuple[str, str] | None:
        """
        Parse a README filename into (component_name, markdown_hash).
        Format: {component-name}-{hash}.md
        """
        match = re.match(r"^(.+)-([a-f0-9]{12})\.md$", filename)
        if match:
            return match.group(1), match.group(2)
        return None

    def list_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all available versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of versions, sorted newest to oldest
        """
        dist_dir = self.inventory_dir / distribution
        if not dist_dir.exists():
            return []

        versions = []
        for item in dist_dir.iterdir():
            if item.is_dir():
                try:
                    version = Version(item.name.lstrip("v"))
                    versions.append(version)
                except ValueError:
                    continue

        return sorted(versions, reverse=True)

    def list_snapshot_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all snapshot versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of snapshot versions
        """
        all_versions = self.list_versions(distribution)
        return [v for v in all_versions if v.prerelease]

    def list_release_versions(self, distribution: DistributionName) -> list[Version]:
        """
        List all release (non-prerelease) versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            List of release versions, sorted newest to oldest
        """
        all_versions = self.list_versions(distribution)
        return [v for v in all_versions if not v.prerelease]

    def cleanup_snapshots(self, distribution: DistributionName) -> int:
        """
        Remove all snapshot versions for a distribution.

        Args:
            distribution: Distribution name

        Returns:
            Number of snapshot versions removed
        """
        snapshots = self.list_snapshot_versions(distribution)
        count = 0

        for snapshot in snapshots:
            snapshot_dir = self.get_version_dir(distribution, snapshot)
            if snapshot_dir.exists():
                shutil.rmtree(snapshot_dir)
                count += 1

        if count > 0:
            self.prune_orphan_schemas()

        return count

    def version_exists(self, distribution: DistributionName, version: Version) -> bool:
        """
        Check if a specific version exists for a distribution.

        Args:
            distribution: Distribution name
            version: Version to check

        Returns:
            True if version directory exists
        """
        version_dir = self.get_version_dir(distribution, version)
        return version_dir.exists()

    def delete_version(self, distribution: DistributionName, version: Version) -> bool:
        """
        Delete a specific version directory for a distribution.

        Args:
            distribution: Distribution name
            version: Version to delete

        Returns:
            True if version was deleted, False if it didn't exist
        """
        version_dir = self.get_version_dir(distribution, version)
        if version_dir.exists():
            shutil.rmtree(version_dir)
            self.prune_orphan_schemas()
            return True
        return False

    def load_deprecations(self) -> dict[str, dict[str, list[dict[str, Any]]]]:
        """
        Load consolidated deprecations index.

        Returns:
            Dictionary with structure: {distribution: {component_type: [deprecated_components]}}
            Returns empty structure if file doesn't exist
        """
        deprecations_file = self.inventory_dir / "deprecations.yaml"

        if not deprecations_file.exists():
            logger.debug("Deprecations file does not exist, returning empty structure")
            return {
                "core": {component_type: [] for component_type in COMPONENT_TYPES},
                "contrib": {component_type: [] for component_type in COMPONENT_TYPES},
            }

        with open(deprecations_file, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        for dist in ["core", "contrib"]:
            if dist not in data:
                data[dist] = {}
            for component_type in COMPONENT_TYPES:
                if component_type not in data[dist]:
                    data[dist][component_type] = []

        return data

    def save_deprecations(self, deprecations: dict[str, dict[str, list[dict[str, Any]]]]) -> None:
        """
        Save consolidated deprecations index.

        Args:
            deprecations: Dictionary with structure: {distribution: {component_type: [deprecated_components]}}
        """
        deprecations_file = self.inventory_dir / "deprecations.yaml"
        self.inventory_dir.mkdir(parents=True, exist_ok=True)

        with open(deprecations_file, "w", encoding="utf-8") as f:
            yaml.dump(deprecations, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        logger.info(f"Saved deprecations index to {deprecations_file}")

    @staticmethod
    def add_deprecated_components(
        deprecations: dict[str, dict[str, list[dict[str, Any]]]],
        distribution: DistributionName,
        new_deprecated: dict[str, list[dict[str, Any]]],
    ) -> None:
        """
        Add newly deprecated components to the index, avoiding duplicates.

        Args:
            deprecations: Existing deprecations index
            distribution: Distribution name (core or contrib)
            new_deprecated: New deprecated components by type
        """
        for component_type, components in new_deprecated.items():
            existing_names = {comp["name"] for comp in deprecations[distribution][component_type]}

            for component in components:
                if component["name"] not in existing_names:
                    deprecations[distribution][component_type].append(component)
                    logger.info(
                        f"Added deprecated {component_type}: {component['name']} "
                        f"(removed in {component['deprecated_in_version']})"
                    )
                else:
                    logger.debug(f"Skipping duplicate deprecated {component_type}: {component['name']}")
