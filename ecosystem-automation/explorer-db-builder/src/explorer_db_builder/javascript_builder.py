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
"""Orchestrates the JavaScript instrumentation database build pipeline."""

import logging
from typing import Any, Optional

from js_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.javascript_database_writer import JavascriptDatabaseWriter

logger = logging.getLogger(__name__)

REGISTRY_DIR = "ecosystem-registry/javascript"


# Fields published per package. Everything else in the registry stays out:
# `version` lives in index.json so releases that only bumped it share one file,
# `repository` is the same for every package, and owners aren't published for
# any other ecosystem either.
PACKAGE_FIELDS = (
    "name",
    "npm_package",
    "description",
    "source_path",
    "node_engine",
    "in_auto_instrumentations_node",
    "supported_versions",
    "tested_versions",
)


def make_package(release: dict[str, Any]) -> dict[str, Any]:
    """Reduce one registry release to the published package metadata."""
    return {field: release[field] for field in PACKAGE_FIELDS if field in release}


def make_index_package(package: dict[str, Any], releases: list[dict[str, str]]) -> dict[str, Any]:
    """Build the index.json entry for a package.

    Args:
        package: Published metadata of the package's latest release.
        releases: {"version", "hash"} for every release, newest first. A list
            rather than a version -> hash mapping, because the JSON is written
            with sorted keys and 0.10.0 would sort below 0.9.0.

    Returns:
        The fields the list page needs, plus where to find each release.
    """
    return {
        "name": package["name"],
        "npm_package": package.get("npm_package"),
        "description": package.get("description"),
        "in_auto_instrumentations_node": bool(package.get("in_auto_instrumentations_node")),
        "version": releases[0]["version"],
        "releases": releases,
    }


def run_javascript_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[JavascriptDatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the JavaScript instrumentation database build.

    Every stored release of every package is listed in index.json, not just the
    latest, so the detail page can offer a version picker later without a schema
    change. Releases with identical metadata share one package file.

    Args:
        inventory_manager: Optional inventory manager (for testing).
        db_writer: Optional database writer (for testing).
        clean: If True, wipe the output directory before building.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    try:
        inventory_manager = inventory_manager or InventoryManager(registry_dir=REGISTRY_DIR)
        db_writer = db_writer or JavascriptDatabaseWriter()

        if clean:
            db_writer.clean()

        packages = inventory_manager.list_packages()
        if not packages:
            raise ValueError("No packages found in the javascript registry")

        logger.info(f"Processing {len(packages)} javascript packages")

        index_entries: list[dict[str, Any]] = []
        release_count = 0
        for package_name in packages:
            # Sorted as semver: sorted as text, 0.9.0 would land above 0.10.0.
            versions = sorted((Version(v) for v in inventory_manager.list_versions(package_name)), reverse=True)

            latest: dict[str, Any] = {}
            releases: list[dict[str, str]] = []
            for version in versions:
                release = inventory_manager.load(package_name, str(version))
                if release.get("name") != package_name:
                    raise ValueError(f"Registry file for {package_name} v{version} has name {release.get('name')!r}")

                package = make_package(release)
                package_hash = db_writer.write_package(package)
                releases.append({"version": str(version), "hash": package_hash})
                release_count += 1
                if not latest:
                    latest = package

            index_entries.append(make_index_package(latest, releases))

        db_writer.write_index(index_entries)

        # index.json (the reachability source) is on disk now. Skipped after
        # --clean, which already wiped everything.
        if not clean:
            db_writer.remove_orphans()

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)
        logger.info("")
        logger.info("JavaScript Database Statistics:")
        logger.info(f"  Packages: {len(index_entries)} ({release_count} releases)")
        logger.info(f"  Files written: {stats['files_written']}")
        logger.info(f"  Total size: {stats['total_bytes']:,} bytes ({total_mb:.2f} MB)")
        return 0

    except ValueError as e:
        logger.error(f"❌ Validation error: {e}")
        return 1
    except OSError as e:
        logger.error(f"❌ File system error: {e}")
        return 1
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return 1
