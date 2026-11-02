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
import re
from pathlib import Path

from watcher_common.version_detector import VersionDetector

from .inventory_manager import InventoryManager

logger = logging.getLogger(__name__)
TAG_PREFIX = "browser-instrumentation-v"
PACKAGE_PATH = "packages/instrumentation"
PACKAGE_NAME = "@opentelemetry/browser-instrumentation"
SCOPE_NAME_RE = re.compile(r"""^\s*super\(\s*(['"])([^'"\r\n]+)\1\s*,""", re.MULTILINE)


def _skip_reason(export: str) -> str | None:
    """Return why an export is not a module, or None when its source should be checked."""
    if not export.startswith("./experimental/"):
        return "not an experimental export"
    name = export.removeprefix("./experimental/")
    if not name or "/" in name or name in {".", ".."}:
        return "not a single module name"
    return None


class BrowserSync:
    """Store one immutable package entry with its exported modules per release."""

    tag_prefix = TAG_PREFIX
    package_name = "browser-instrumentation"

    def __init__(self, repo_path: Path, inventory_manager: InventoryManager):
        self.detector = VersionDetector(repo_path, tag_prefix=self.tag_prefix)
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
            # package.json is a package export, not an instrumentation module.
            if export == "./package.json":
                continue
            reason = _skip_reason(export)
            name = export.removeprefix("./experimental/")
            source_path = f"{PACKAGE_PATH}/src/{name}"
            if reason is None and self.detector.read_file_at_ref(ref, f"{source_path}/index.ts") is None:
                reason = "missing index.ts"
            if reason is not None:
                logger.warning("Skipping browser export %s at %s: %s", export, ref, reason)
                continue
            module = {
                "name": name,
                "import_path": f"{PACKAGE_NAME}/{export.removeprefix('./')}",
                "source_path": source_path,
            }
            instrumentation = self.detector.read_file_at_ref(ref, f"{source_path}/instrumentation.ts")
            if instrumentation is None:
                logger.warning(
                    "Missing browser scope_name for %s at %s: %s", source_path, ref, "missing instrumentation.ts"
                )
            else:
                match = SCOPE_NAME_RE.search(instrumentation)
                if match:
                    module["scope_name"] = match.group(2)
                else:
                    logger.warning(
                        "Missing browser scope_name for %s at %s: %s", source_path, ref, "pattern does not match"
                    )
            modules.append(module)
        if not modules:
            raise ValueError(f"No exported instrumentation modules at {ref}")
        entry = {
            "name": "browser-instrumentation",
            "npm_package": PACKAGE_NAME,
            "version": version,
            "repository": "open-telemetry/opentelemetry-browser",
            "source_path": PACKAGE_PATH,
            "modules": modules,
        }
        description = package.get("description") or ""
        if description:
            entry["description"] = description
        keywords = package.get("keywords")
        if isinstance(keywords, list) and "web" in keywords:
            entry["platform"] = "browser"
        return entry

    def sync(self) -> dict[str, list[str]]:
        """Detect all stable release tags and backfill only missing versions."""
        self.detector.fetch_tags()
        summary: dict[str, list[str]] = {"new": [], "skipped": [], "failed": []}
        for release in self.detector.get_all_release_tags():
            version = str(release)
            if self.inventory_manager.version_exists(self.package_name, version):
                summary["skipped"].append(version)
                continue
            try:
                data = self.parse(version)
                self.inventory_manager.save(self.package_name, version, data)
            except Exception:
                logger.exception("Failed to sync %s %s", self.package_name, version)
                summary["failed"].append(version)
                continue
            summary["new"].append(version)
        return summary
