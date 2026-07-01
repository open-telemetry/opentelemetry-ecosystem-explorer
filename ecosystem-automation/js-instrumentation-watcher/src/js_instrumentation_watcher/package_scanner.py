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

"""Scanner for JS instrumentation packages in the js-contrib repository."""

import json
import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

PACKAGES_DIR = "packages"
INSTRUMENTATION_PREFIX = "instrumentation-"
AUTO_NODE_PKG = "packages/auto-instrumentations-node/package.json"
COMPONENT_OWNERS_FILE = ".github/component_owners.yml"


class PackageScanner:
    """
    Scans the js-contrib repository for instrumentation packages.

    Discovers all packages/instrumentation-* directories and reads
    the structured metadata available without README parsing.
    """

    def __init__(self, repo_path: Path):
        """
        Args:
            repo_path: Path to the cloned opentelemetry-js-contrib repository
        """
        self.repo_path = repo_path

    def discover_packages(self) -> list[Path]:
        """
        Discover all active instrumentation package directories.

        Returns:
            Sorted list of paths to instrumentation package directories
            that have an active package.json
        """
        packages_dir = self.repo_path / PACKAGES_DIR
        if not packages_dir.exists():
            logger.warning("packages/ directory not found at %s", packages_dir)
            return []

        found = []
        for item in sorted(packages_dir.iterdir()):
            if not item.is_dir():
                continue
            if not item.name.startswith(INSTRUMENTATION_PREFIX):
                continue
            if not (item / "package.json").exists():
                logger.debug("Skipping %s — no package.json (likely deprecated)", item.name)
                continue
            found.append(item)

        logger.info("Found %d active instrumentation packages", len(found))
        return found

    def load_bundle_membership(self) -> set[str]:
        """
        Load the set of package names included in auto-instrumentations-node.

        Returns:
            Set of npm package names included in the node auto-instrumentation bundle.
            Returns an empty set if the file is missing, malformed, or has an
            unexpected shape (not a dict, or 'dependencies' is not a mapping).
        """
        auto_node_path = self.repo_path / AUTO_NODE_PKG
        if not auto_node_path.exists():
            logger.warning("auto-instrumentations-node package.json not found")
            return set()

        try:
            data = json.loads(auto_node_path.read_text())
            deps = data.get("dependencies", {}) if isinstance(data, dict) else {}
            return set(deps.keys()) if isinstance(deps, dict) else set()
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load auto-instrumentations-node deps: %s", e)
            return set()

    def load_component_owners(self) -> dict[str, list[str]]:
        """
        Load component owners from .github/component_owners.yml.

        Returns:
            Dict mapping package path (e.g. 'packages/instrumentation-express')
            to list of owner GitHub handles. Returns an empty dict if the file
            is missing, malformed, or has an unexpected shape (not a dict, or
            'components' is not a mapping).
        """
        owners_path = self.repo_path / COMPONENT_OWNERS_FILE
        if not owners_path.exists():
            logger.warning("component_owners.yml not found")
            return {}

        try:
            data = yaml.safe_load(owners_path.read_text())
            if not isinstance(data, dict):
                return {}

            components = data.get("components", {})
            if not isinstance(components, dict):
                return {}

            result = {}
            for path, owners in components.items():
                result[path] = owners if isinstance(owners, list) else []
            return result
        except (yaml.YAMLError, OSError) as e:
            logger.warning("Failed to load component_owners.yml: %s", e)
            return {}
