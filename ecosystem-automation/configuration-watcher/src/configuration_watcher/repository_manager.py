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
"""Manages OpenTelemetry configuration repository setup and access."""

import logging
import subprocess
from pathlib import Path

from watcher_common.repository_manager import BaseRepositoryManager

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/open-telemetry/opentelemetry-configuration.git"
ENV_VAR_NAME = "OTEL_CONFIGURATION_PATH"
DEFAULT_REPO_NAME = "opentelemetry-configuration"


class RepositoryManager(BaseRepositoryManager):
    """Manages OpenTelemetry configuration repository location and setup."""

    def get_repository_path(self) -> Path | None:
        """
        Get the path to a repository from environment variable.

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        return super()._get_repository_path(ENV_VAR_NAME)

    def setup_repository(self) -> Path:
        """
        Set up the repository by cloning or using existing location.

        If an environment variable is set, use that path (and pull latest).
        Otherwise, clone to base_dir if needed, or pull if already cloned.

        Returns:
            Path to the repository

        Raises:
            RuntimeError: If setup fails
        """
        env_path = self.get_repository_path()
        if env_path:
            self._pull_latest(env_path)
            return env_path

        repo_path = self.base_dir / DEFAULT_REPO_NAME

        if not repo_path.exists():
            logger.info("Cloning configuration repository to %s", repo_path)
            self._clone_repository(REPO_URL, repo_path)
        else:
            logger.info("Updating configuration repository at %s", repo_path)
            self._pull_latest(repo_path)

        return repo_path

    def _pull_latest(self, repo_path: Path) -> None:
        """
        Pull latest changes from remote.

        Discards any local changes left from previous tag checkouts before
        pulling, and uses --ff-only to avoid unintended merges.

        Args:
            repo_path: Path to the repository

        Raises:
            RuntimeError: If pull fails
        """
        try:
            # Discard any local changes left from previous tag checkouts
            subprocess.run(
                ["git", "checkout", "."],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "checkout", "main"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "pull", "--ff-only"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "fetch", "--tags"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully pulled latest changes at %s", repo_path)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to pull latest changes: {e.stderr}") from e
