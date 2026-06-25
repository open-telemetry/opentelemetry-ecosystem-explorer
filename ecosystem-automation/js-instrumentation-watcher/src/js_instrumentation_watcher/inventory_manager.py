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

"""Inventory manager for JS instrumentation registry storage."""

import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


class InventoryManager:
    """
    Manages storage of JS instrumentation metadata in the registry.

    Registry layout:
        ecosystem-registry/javascript/{package-name}/v{version}.yaml
    """

    def __init__(self, registry_dir: str):
        """
        Args:
            registry_dir: Base registry directory, e.g. 'ecosystem-registry/javascript'
        """
        self.registry_dir = Path(registry_dir)

    def version_exists(self, package_name: str, version: str) -> bool:
        """
        Check if a specific package version already exists in the registry.

        Args:
            package_name: Package directory name, e.g. 'instrumentation-express'
            version: Version string, e.g. '0.66.0'

        Returns:
            True if the version file exists
        """
        return self._version_path(package_name, version).exists()

    def save(self, package_name: str, version: str, data: dict) -> None:
        """
        Save a package version to the registry.

        Args:
            package_name: Package directory name
            version: Version string
            data: Metadata dict to serialize as YAML
        """
        path = self._version_path(package_name, version)
        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("w") as f:
            yaml.dump(
                data,
                f,
                default_flow_style=False,
                sort_keys=True,
                allow_unicode=True,
            )

        logger.debug("Saved %s v%s to %s", package_name, version, path)

    def _version_path(self, package_name: str, version: str) -> Path:
        """
        Build the path for a package version file.

        Args:
            package_name: Package directory name
            version: Version string

        Returns:
            Path to the version YAML file
        """
        return self.registry_dir / package_name / f"v{version}.yaml"
