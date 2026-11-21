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
"""Orchestrates the Python instrumentation database build pipeline."""

from typing import Any, Optional

from packaging.version import InvalidVersion, Version
from python_instrumentation_watcher.inventory_manager import InventoryManager

from explorer_db_builder.package_index_builder import build_package_index
from explorer_db_builder.python_database_writer import PythonDatabaseWriter

REGISTRY_DIR = "ecosystem-registry/python"


# Fields published per package. Everything else in the registry stays out: `version` lives in
# index.json so releases that only bumped it share one file.
# `supports_metrics` and `semantic_convention_status` are published as the registry has them. Both
# are null when upstream does not say, and null (unknown) must not become false or "none".
PACKAGE_FIELDS = (
    "name",
    "description",
    "source_path",
    "repository",
    "homepage",
    "requires_python",
    "entry_points",
    "instruments",
    "supports_metrics",
    "semantic_convention_status",
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
            with sorted keys and 0.10b0 would sort below 0.9b0.

    Returns:
        The fields the list page needs, plus where to find each release. Missing
        supports_metrics and semantic_convention_status are written as null, never false.
    """
    return {
        "name": package["name"],
        "description": package.get("description"),
        "supports_metrics": package.get("supports_metrics"),
        "semantic_convention_status": package.get("semantic_convention_status"),
        "version": releases[0]["version"],
        "releases": releases,
    }


def sort_versions(package_name: str, versions: list[str]) -> list[str]:
    """Order registry version strings newest first as PEP 440 versions.

    semantic_version cannot parse Python releases such as 0.66b2, and text order puts 0.9b0 above
    0.10b0. The registry's own strings are returned, not their normalized forms, because they are
    also the file names the releases are loaded from.

    Args:
        package_name: Used in error messages.
        versions: Version strings as stored in the registry, in any order.

    Returns:
        The same strings, newest first.

    Raises:
        ValueError: If a version is not PEP 440, or two strings are the same version (for example
            0.66b2 and 0.66.0b2), which would make the "latest" release ambiguous.
    """
    parsed: dict[Version, str] = {}
    for raw in versions:
        try:
            version = Version(raw)
        except InvalidVersion as e:
            raise ValueError(f"Registry version {raw!r} of {package_name} is not a PEP 440 version") from e
        if version in parsed:
            raise ValueError(
                f"Registry versions {parsed[version]!r} and {raw!r} of {package_name} are the same version"
            )
        parsed[version] = raw
    return [parsed[version] for version in sorted(parsed, reverse=True)]


def run_python_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[PythonDatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the Python instrumentation database build.

    Prereleases are included: python-contrib has only published 0.NbN versions so far.

    Args:
        inventory_manager: Optional inventory manager (for testing).
        db_writer: Optional database writer (for testing).
        clean: If True, wipe the output directory before building.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    return build_package_index(
        "python",
        inventory_manager or InventoryManager(registry_dir=REGISTRY_DIR),
        db_writer or PythonDatabaseWriter(),
        make_package=make_package,
        make_index_package=make_index_package,
        sort_versions=sort_versions,
        clean=clean,
    )
