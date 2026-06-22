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

"""Synchronization orchestration for JS instrumentation metadata."""

import logging
from pathlib import Path
from typing import Any

from .inventory_manager import InventoryManager
from .package_parser import PackageParser
from .package_scanner import PackageScanner

logger = logging.getLogger(__name__)


class InstrumentationSync:
    """
    Orchestrates synchronization of JS instrumentation metadata.

    Walks the js-contrib repository, parses each instrumentation package,
    and writes per-package versioned YAML to the registry.

    Unlike the Java watcher which has a single release version, JS packages
    version independently. Each package is stored at its own version:
        ecosystem-registry/javascript/{package}/v{version}.yaml
    """

    def __init__(
        self,
        repo_path: Path,
        inventory_manager: InventoryManager,
    ):
        """
        Args:
            repo_path: Path to the cloned opentelemetry-js-contrib repository
            inventory_manager: Inventory manager for writing registry files
        """
        self.repo_path = repo_path
        self.inventory_manager = inventory_manager
        self.scanner = PackageScanner(repo_path)

    def sync(self) -> dict[str, Any]:
        """
        Synchronize all JS instrumentation packages to the registry.

        For each package:
        - If the current version already exists in the registry, skip it
        - Otherwise parse and write the metadata

        Returns:
            Summary dict with counts of new, skipped, and failed packages
        """
        summary: dict[str, Any] = {
            "new": [],
            "skipped": [],
            "failed": [],
        }

        bundle_membership = self.scanner.load_bundle_membership()
        logger.info("Loaded %d packages from auto-instrumentations-node", len(bundle_membership))

        component_owners = self.scanner.load_component_owners()
        logger.info("Loaded owners for %d components", len(component_owners))

        packages = self.scanner.discover_packages()

        for package_path in packages:
            name = package_path.name
            parser = PackageParser(
                package_path=package_path,
                bundle_membership=bundle_membership,
                component_owners=component_owners,
            )

            try:
                data = parser.parse()
            except Exception:
                logger.exception("Failed to parse %s", name)
                summary["failed"].append(name)
                continue

            if data is None:
                logger.warning("No data parsed for %s — skipping", name)
                summary["failed"].append(name)
                continue

            version = data.get("version", "")
            if not version:
                logger.warning("No version found for %s — skipping", name)
                summary["failed"].append(name)
                continue

            if self.inventory_manager.version_exists(name, version):
                logger.debug("Already tracked: %s v%s", name, version)
                summary["skipped"].append(f"{name}@{version}")
                continue

            self.inventory_manager.save(name, version, data)
            logger.info("Saved: %s v%s", name, version)
            summary["new"].append(f"{name}@{version}")

        logger.info(
            "Sync complete — new: %d, skipped: %d, failed: %d",
            len(summary["new"]),
            len(summary["skipped"]),
            len(summary["failed"]),
        )

        return summary
