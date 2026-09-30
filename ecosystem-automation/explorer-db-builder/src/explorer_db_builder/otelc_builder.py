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
"""Orchestrates the otelc database build pipeline."""

import json
import logging
import shutil
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version
from watcher_common.inventory_manager import BaseInventoryManager

from explorer_db_builder.content_hashing import content_hash

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1


class GoInventoryManager(BaseInventoryManager):
    """Manages Go instrumentation inventory retrieval."""

    FILE_NAME = "instrumentation.yaml"

    def load_versioned_inventory(self, version: Version) -> dict[str, Any]:
        """Load inventory for a specific version."""
        file_path = self.get_version_dir(version) / self.FILE_NAME
        if not file_path.exists():
            return {}

        try:
            with open(file_path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            if not isinstance(data, dict):
                logger.warning(f"Inventory file at {file_path} is not a valid YAML mapping")
                return {}
            return data
        except Exception as e:
            logger.warning(f"Failed to load inventory from {file_path}: {e}")
            return {}

    def get_automatic_instrumentations(self, version: Version) -> list[dict[str, Any]]:
        """Return a stripped-down list of instrumentations marked as 'automatic'."""
        inv = self.load_versioned_inventory(version)
        libraries = inv.get("libraries", [])

        filtered = []
        for lib in libraries:
            # Only include if 'automatic' is in installation.methods
            methods = lib.get("installation", {}).get("methods", [])
            if "automatic" not in methods:
                continue

            # Keep only allowed fields for otelc
            allowed_fields = {
                "name",
                "display_name",
                "description",
                "target_module",
                "modules",
                "go_min_version",
                "otelc_min_version",
                "stability",
            }
            stripped = {k: v for k, v in lib.items() if k in allowed_fields}
            filtered.append(stripped)
        return filtered


def _parse_min_v(s: str) -> Version:
    """Parse Go toolchain versions (like '1.22') or otelc versions safely."""
    if not s:
        return Version("0.0.0")
    try:
        cleaned = s.lstrip("v")
        if cleaned.count(".") == 1:
            cleaned += ".0"
        return Version(cleaned)
    except Exception:
        logger.warning(f"Unparseable version string: {s!r}, treating as unconstrained")
        return Version("0.0.0")


def run_otelc_builder(
    registry_dir: str = "ecosystem-registry",
    output_dir: str = "ecosystem-explorer/public/data",
    clean: bool = False,
) -> int:
    go_base = Path(registry_dir) / "go"
    out_base = Path(output_dir) / "otelc" / f"v{SCHEMA_VERSION}"

    if clean and out_base.exists():
        logger.info(f"Cleaning otelc output directory: {out_base}")
        shutil.rmtree(out_base)

    if not go_base.exists():
        logger.warning(f"No Go registry found at {go_base}")
        return 0

    all_repos = [p for p in go_base.iterdir() if p.is_dir()]
    catalog_repositories = []

    releases_dir = out_base / "releases"
    releases_dir.mkdir(parents=True, exist_ok=True)

    for r in all_repos:
        mgr = GoInventoryManager(str(r))
        repo_releases = []

        for version in mgr.list_release_versions():
            try:
                libs = mgr.get_automatic_instrumentations(version)

                # If this specific release has no automatic instrumentations, skip it.
                # (If a repo NEVER has any, it will result in an empty list and be dropped below).
                if not libs:
                    continue

                libs.sort(key=lambda x: x.get("name", ""))

                max_go = Version("0.0.0")
                max_otelc = Version("0.0.0")

                for lib in libs:
                    gv = _parse_min_v(lib.get("go_min_version", ""))
                    if gv > max_go:
                        max_go = gv

                    ov = _parse_min_v(lib.get("otelc_min_version", ""))
                    if ov > max_otelc:
                        max_otelc = ov

                registry_data: dict[str, Any] = {"schema_version": SCHEMA_VERSION, "instrumentations": libs}

                registry_hash = content_hash(registry_data)
                registry_data["registry_hash"] = registry_hash

                reg_file = releases_dir / f"registry-{registry_hash}.json"
                if not reg_file.exists():
                    with open(reg_file, "w", encoding="utf-8") as f:
                        json.dump(registry_data, f, indent=2, sort_keys=True)
                    logger.info(
                        f"Wrote registry-{registry_hash}.json for {r.name} {version} ({len(libs)} instrumentations)"
                    )

                # list_release_versions() is sorted newest-to-oldest, so the first entry is always the latest release
                is_latest = len(repo_releases) == 0

                repo_releases.append(
                    {
                        "version": f"v{version}",
                        "registry_hash": registry_hash,
                        "is_latest": is_latest,
                        "min_otelc_version": f"v{max_otelc}" if max_otelc != Version("0.0.0") else "",
                        "min_go_version": f"{max_go.major}.{max_go.minor}" if max_go != Version("0.0.0") else "",
                    }
                )
            except Exception as e:
                logger.error(f"Failed processing release {version} for repo {r.name}: {e}")
                continue

        # Only add the repository to the catalog if it contributed at least one valid release
        if repo_releases:
            catalog_repositories.append({"name": r.name, "releases": repo_releases})
        else:
            logger.debug(f"Repo {r.name} yielded no automatic releases; omitting from catalog.")

    if not catalog_repositories:
        logger.warning("No Go repositories generated automatic instrumentations.")
        return 0

    # Ensure consistent repo ordering in the catalog
    catalog_repositories.sort(key=lambda x: x["name"])

    catalog_data = {"schema_version": SCHEMA_VERSION, "repositories": catalog_repositories}

    catalog_file = out_base / "catalog.json"
    with open(catalog_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, sort_keys=True)

    total_releases = sum(len(r["releases"]) for r in catalog_repositories)
    logger.info(f"Wrote catalog.json containing {len(catalog_repositories)} repos and {total_releases} total releases")

    return 0
