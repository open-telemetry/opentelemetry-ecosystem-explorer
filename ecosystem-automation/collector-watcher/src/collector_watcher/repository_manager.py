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
"""Manages OpenTelemetry Collector repository setup and access.

Handles cloning, updating, and accessing collector repositories based on
environment variables or default locations.
"""

import logging
from pathlib import Path
from typing import Optional

from semantic_version import Version
from watcher_common.repository_manager import BaseRepositoryManager

from .type_defs import DistributionName

logger = logging.getLogger(__name__)

REPO_URLS = {
    "core": "https://github.com/open-telemetry/opentelemetry-collector.git",
    "contrib": "https://github.com/open-telemetry/opentelemetry-collector-contrib.git",
}

ENV_VAR_NAMES = {
    "core": "OTEL_COLLECTOR_CORE_PATH",
    "contrib": "OTEL_COLLECTOR_CONTRIB_PATH",
}


class RepositoryManager(BaseRepositoryManager):
    """Manages OpenTelemetry Collector repository locations and setup."""

    def get_repository_path(self, distribution: DistributionName) -> Optional[Path]:  # type: ignore[override]
        """
        Get the path to a repository from environment variable.

        Args:
            distribution: The distribution name (core or contrib)

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        return super().get_repository_path(ENV_VAR_NAMES[distribution])

    def setup_repository(
        self,
        distribution: DistributionName,
        version: Optional[Version] = None,
        update: bool = True,
    ) -> Path:
        """
        Set up a repository by cloning or using existing location.

        If an environment variable is set, use that path.
        Otherwise, clone to base_dir if needed.

        Args:
            distribution: The distribution name (core or contrib)
            version: Optional version to checkout. If None, uses main branch
            update: Whether to pull latest changes for existing repos

        Returns:
            Path to the repository

        Raises:
            RuntimeError: If setup fails
        """
        # Check for environment variable first
        env_path = self.get_repository_path(distribution)
        if env_path:
            if version:
                logger.info("Checking out %s repository at %s", distribution, env_path)
                self._checkout_version(env_path, version)
            elif update:
                logger.info("Updating %s repository at %s", distribution, env_path)
                self._pull_latest(env_path)
            return env_path

        # Use default location in base_dir
        repo_path = self.base_dir / f"opentelemetry-collector-{distribution}"

        if not repo_path.exists():
            logger.info("Cloning %s repository to %s", distribution, repo_path)
            self._clone_repository(REPO_URLS[distribution], repo_path)
        elif update and version is None:
            logger.info("Updating %s repository at %s", distribution, repo_path)
            self._pull_latest(repo_path)

        if version:
            self._checkout_version(repo_path, version)

        return repo_path

    def setup_all_repositories(
        self,
        version: Optional[Version] = None,
        update: bool = True,
    ) -> dict[DistributionName, Path]:
        """
        Set up all collector repositories.

        Args:
            version: Optional version to checkout for all repos
            update: Whether to pull latest changes for existing repos

        Returns:
            Dictionary mapping distribution names to repository paths
        """
        return {
            "core": self.setup_repository("core", version, update),
            "contrib": self.setup_repository("contrib", version, update),
        }
