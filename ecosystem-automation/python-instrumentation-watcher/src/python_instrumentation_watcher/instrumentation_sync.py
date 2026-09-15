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

"""Synchronization orchestration for Python instrumentation metadata."""

import logging
from pathlib import Path
from typing import Any

from .inventory_manager import InventoryManager
from .package_parser import PackageParser
from .package_scanner import PackageScanner

logger = logging.getLogger(__name__)


class InstrumentationSync:
    """
    Orchestrates synchronization of Python instrumentation metadata.

    Walks the python-contrib repository, parses each instrumentation package,
    and writes per-package versioned YAML to the registry.

    Like the JS watcher (and unlike Java's single release version), Python
    packages are resolved and stored at their own, independent version:
        ecosystem-registry/python/{package}/v{version}.yaml
    This is deliberate for Python's hybrid lockstep/independent release model —
    see projects/135-python-instrumentation/02-schema-design.md §6.
    """

    def __init__(
        self,
        repo_path: Path,
        inventory_manager: InventoryManager,
    ):
        """
        Args:
            repo_path: Path to the cloned opentelemetry-python-contrib repository
            inventory_manager: Inventory manager for writing registry files
        """
        self.repo_path = repo_path
        self.inventory_manager = inventory_manager
        self.scanner = PackageScanner(repo_path)

    def sync(self) -> dict[str, Any]:
        """
        Synchronize all Python instrumentation packages to the registry.

        For each package:
        - If the current version already exists in the registry, skip it
        - Otherwise parse and write the metadata
        - Separately, report (but do not block on) a pyproject.toml/package.py
          `instruments` disagreement, per schema design §7 open decision #2

        Returns:
            Summary dict with counts of new, skipped, failed, and
            metadata-disagreeing packages
        """
        summary: dict[str, Any] = {
            "new": [],
            "skipped": [],
            "failed": [],
            "disagreements": [],
        }

        packages = self.scanner.discover_packages()

        for package_path in packages:
            name = package_path.name
            parser = PackageParser(package_path=package_path, repo_path=self.repo_path)

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

            package_id = f"{name}@{version}"

            if parser.has_metadata_disagreement():
                logger.warning(
                    "pyproject.toml and package.py disagree on instruments for %s; "
                    "using pyproject.toml (authoritative)",
                    package_id,
                )
                summary["disagreements"].append(package_id)

            if self.inventory_manager.version_exists(name, version):
                logger.debug("Already tracked: %s", package_id)
                summary["skipped"].append(package_id)
                continue

            self.inventory_manager.save(name, version, data)
            logger.info("Saved: %s", package_id)
            summary["new"].append(package_id)

        logger.info(
            "Sync complete — new: %d, skipped: %d, failed: %d, disagreements: %d",
            len(summary["new"]),
            len(summary["skipped"]),
            len(summary["failed"]),
            len(summary["disagreements"]),
        )

        return summary
