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

import yaml
from watcher_common.inventory_manager import PackageInventoryManager

logger = logging.getLogger(__name__)


class InventoryManager(PackageInventoryManager):
    """
    Manages storage of JS instrumentation metadata in the registry.

    Registry layout:
        ecosystem-registry/javascript/{package-name}/v{version}.yaml
    """

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
