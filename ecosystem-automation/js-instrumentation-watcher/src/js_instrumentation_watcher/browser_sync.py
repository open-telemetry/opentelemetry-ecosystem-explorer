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

"""Read browser package metadata at release tags without checking them out."""

import json
import logging
from pathlib import Path

from watcher_common.version_detector import VersionDetector

from .inventory_manager import InventoryManager

logger = logging.getLogger(__name__)
TAG_PREFIX = "browser-instrumentation-v"
PACKAGE_PATH = "packages/instrumentation"
PACKAGE_NAME = "@opentelemetry/browser-instrumentation"


class BrowserSync:
    """Store one immutable package entry with its exported modules per release."""

    def __init__(self, repo_path: Path, inventory_manager: InventoryManager):
        self.detector = VersionDetector(repo_path, tag_prefix=TAG_PREFIX)
        self.inventory_manager = inventory_manager

    def parse(self, version: str) -> dict:
        """Read the manifest and verify each module exists at the same tag."""
        ref = f"refs/tags/{TAG_PREFIX}{version}"
        content = self.detector.read_file_at_ref(ref, f"{PACKAGE_PATH}/package.json")
        if content is None:
            raise ValueError(f"Missing package.json at {ref}")
        package = json.loads(content)
        if package.get("name") != PACKAGE_NAME or package.get("version") != version:
            raise ValueError(f"Package name/version does not match {ref}")
        modules = []
        for export in sorted(package.get("exports", {})):
            if not export.startswith("./experimental/"):
                continue
            name = export.removeprefix("./experimental/")
            if not name or "/" in name or name in {".", ".."}:
                continue
            source_path = f"{PACKAGE_PATH}/src/{name}"
            if self.detector.read_file_at_ref(ref, f"{source_path}/index.ts") is None:
                continue
            modules.append(
                {
                    "name": name,
                    "import_path": f"{PACKAGE_NAME}/{export.removeprefix('./')}",
                    "source_path": source_path,
                }
            )
        if not modules:
            raise ValueError(f"No exported instrumentation modules at {ref}")
        return {
            "name": "browser-instrumentation",
            "npm_package": PACKAGE_NAME,
            "version": version,
            "description": package.get("description", ""),
            "repository": "open-telemetry/opentelemetry-browser",
            "source_path": PACKAGE_PATH,
            "modules": modules,
        }

    def sync(self) -> dict[str, list[str]]:
        """Detect all stable release tags and backfill only missing versions."""
        self.detector.fetch_tags()
        summary: dict[str, list[str]] = {"new": [], "skipped": [], "failed": []}
        for release in self.detector.get_all_release_tags():
            version = str(release)
            if self.inventory_manager.version_exists("browser-instrumentation", version):
                summary["skipped"].append(version)
                continue
            try:
                data = self.parse(version)
                self.inventory_manager.save("browser-instrumentation", version, data)
            except Exception:
                logger.exception("Failed to sync browser instrumentation %s", version)
                summary["failed"].append(version)
                continue
            summary["new"].append(version)
        return summary
