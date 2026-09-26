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

"""Inventory manager for Python instrumentation registry storage."""

import logging
import os
import tempfile
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


class InventoryManager:
    """
    Manages storage of Python instrumentation metadata in the registry.

    Registry layout (per-package-version, like JavaScript's — see
    projects/135-python-instrumentation/02-schema-design.md §3):
        ecosystem-registry/python/{package-name}/v{version}.yaml
    """

    def __init__(self, registry_dir: str):
        """
        Args:
            registry_dir: Base registry directory, e.g. 'ecosystem-registry/python'
        """
        self.registry_dir = Path(registry_dir)

    def version_exists(self, package_name: str, version: str) -> bool:
        """
        Check if a specific package version already exists in the registry.

        Args:
            package_name: Package directory name, e.g. 'opentelemetry-instrumentation-flask'
            version: Version string, e.g. '0.48b0'

        Returns:
            True if the version file exists
        """
        return self._version_path(package_name, version).exists()

    def save(self, package_name: str, version: str, data: dict) -> None:
        """
        Save a package version to the registry.

        Writes atomically: serializes to a temporary file in the same directory as
        the final path, then replaces the final path only once that write has fully
        succeeded. This guarantees version_exists() can never observe a partial or
        corrupted file at the final path — either the previous complete file is still
        there (nothing written yet), or the new complete file is (write succeeded).
        On any failure, the temporary file is removed and the exception propagates,
        leaving nothing behind at the final path for a later run to misinterpret as
        "already tracked".

        Args:
            package_name: Package directory name
            version: Version string
            data: Metadata dict to serialize as YAML
        """
        path = self._version_path(package_name, version)
        path.parent.mkdir(parents=True, exist_ok=True)

        fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
        tmp_path = Path(tmp_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                yaml.safe_dump(
                    data,
                    f,
                    default_flow_style=False,
                    sort_keys=True,
                    allow_unicode=True,
                )
            os.replace(tmp_path, path)  # atomic on POSIX and Windows; same filesystem
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise

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
