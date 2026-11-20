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
"""The build loop shared by the ecosystems that publish one index.json of independently versioned packages.

javascript and python differ only in which registry fields they publish, how their index entries
look, and how their version strings sort. Those are passed in; everything else (walking the registry,
validating each release, writing content-addressed package files, orphan GC) lives here.
"""

import logging
from collections.abc import Callable
from typing import Any

from watcher_common.inventory_manager import PackageInventoryManager

from explorer_db_builder.package_index_database_writer import PackageIndexDatabaseWriter

logger = logging.getLogger(__name__)


def build_package_index(
    ecosystem: str,
    inventory_manager: PackageInventoryManager,
    db_writer: PackageIndexDatabaseWriter,
    make_package: Callable[[dict[str, Any]], dict[str, Any]],
    make_index_package: Callable[[dict[str, Any], list[dict[str, str]]], dict[str, Any]],
    sort_versions: Callable[[str, list[str]], list[str]],
    clean: bool = False,
) -> int:
    """Run one ecosystem's package-index database build.

    Every stored release of every package is listed in index.json, not just the latest, so the detail
    page can offer a version picker later without a schema change. Releases with identical metadata
    share one package file.

    Args:
        ecosystem: Ecosystem name, used in log and error messages.
        inventory_manager: Registry to read.
        db_writer: Where to write the database.
        make_package: Reduces a registry release to the published package metadata.
        make_index_package: Builds a package's index.json entry from its latest published metadata
            and its releases (``{"version", "hash"}``, newest first).
        sort_versions: Orders a package's registry version strings newest first, returning the
            registry's own strings, because they are the file names releases are loaded from. Raises
            ValueError for a version it cannot order.
        clean: If True, wipe the output directory before building.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    try:
        if clean:
            db_writer.clean()

        packages = inventory_manager.list_packages()
        if not packages:
            raise ValueError(f"No packages found in the {ecosystem} registry")

        logger.info(f"Processing {len(packages)} {ecosystem} packages")

        index_entries: list[dict[str, Any]] = []
        release_count = 0
        for package_name in packages:
            versions = sort_versions(package_name, inventory_manager.list_versions(package_name))

            latest: dict[str, Any] = {}
            releases: list[dict[str, str]] = []
            for version in versions:
                release = inventory_manager.load(package_name, version)
                if release.get("name") != package_name:
                    raise ValueError(f"Registry file for {package_name} v{version} has name {release.get('name')!r}")
                if str(release.get("version")) != version:
                    raise ValueError(
                        f"Registry file for {package_name} v{version} has version {release.get('version')!r}"
                    )

                package = make_package(release)
                package_hash = db_writer.write_package(package)
                releases.append({"version": version, "hash": package_hash})
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
        logger.info(f"{ecosystem} database statistics:")
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
