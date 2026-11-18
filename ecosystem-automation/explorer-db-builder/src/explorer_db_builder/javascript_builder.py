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

from typing import Any, Optional

from js_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.javascript_database_writer import JavascriptDatabaseWriter
from explorer_db_builder.package_index_builder import build_package_index

REGISTRY_DIR = "ecosystem-registry/javascript"


# Fields published per package. Everything else in the registry stays out:
# `version` lives in index.json so releases that only bumped it share one file,
# and owners aren't published for any other ecosystem either.
# `repository` is published because browser entries are not in js-contrib, so
# `source_path` alone does not say which repo a package came from. `modules` is
# the browser registry payload and is published when a release has it. The next
# database build also publishes `repository` on existing js-contrib package files
# and changes their content hashes.
PACKAGE_FIELDS = (
    "name",
    "npm_package",
    "description",
    "source_path",
    "repository",
    "platform",
    "modules",
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
    platform = package.get("platform")
    entry = {
        "name": package["name"],
        "npm_package": package.get("npm_package"),
        "description": package.get("description"),
        "in_auto_instrumentations_node": bool(package.get("in_auto_instrumentations_node")),
        "version": releases[0]["version"],
        "releases": releases,
        **({"platform": platform} if platform else {}),
    }
    module_names = sorted({module["name"] for module in package.get("modules", [])})
    if module_names:
        entry["module_names"] = module_names
    # The upstream migration is tracked in opentelemetry-browser#238.
    if (
        package["name"] == "instrumentation-browser-navigation"
        and package.get("npm_package") == "@opentelemetry/instrumentation-browser-navigation"
        and package.get("repository") == "open-telemetry/opentelemetry-js-contrib"
    ):
        entry["related"] = [
            {
                "npm_package": "@opentelemetry/browser-instrumentation",
                "import_path": "@opentelemetry/browser-instrumentation/experimental/navigation",
                "source_url": "https://github.com/open-telemetry/opentelemetry-browser/tree/main/"
                "packages/instrumentation/src/navigation",
                "reference_url": "https://github.com/open-telemetry/opentelemetry-browser/issues/238",
                "note": "Successor for browser navigation instrumentation. The event API is not a drop-in replacement.",
            }
        ]
    return entry


def sort_versions(package_name: str, versions: list[str]) -> list[str]:
    """Order registry version strings newest first as semver.

    Sorted as text, 0.9.0 would land above 0.10.0.

    Raises:
        ValueError: If a version is not valid semver.
    """
    return [str(v) for v in sorted((Version(v) for v in versions), reverse=True)]


def run_javascript_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[JavascriptDatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the JavaScript instrumentation database build.

    Args:
        inventory_manager: Optional inventory manager (for testing).
        db_writer: Optional database writer (for testing).
        clean: If True, wipe the output directory before building.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    return build_package_index(
        "javascript",
        inventory_manager or InventoryManager(registry_dir=REGISTRY_DIR),
        db_writer or JavascriptDatabaseWriter(),
        make_package=make_package,
        make_index_package=make_index_package,
        sort_versions=sort_versions,
        clean=clean,
    )
