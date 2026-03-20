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
import os
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/open-telemetry/opentelemetry-configuration.git"
ENV_VAR_NAME = "OTEL_CONFIGURATION_PATH"
DEFAULT_REPOS_DIR = "tmp_repos"
DEFAULT_REPO_NAME = "opentelemetry-configuration"


class RepositoryManager:
    """Manages OpenTelemetry configuration repository location and setup."""

    def __init__(self, base_dir: str | None = None):
        """
        Args:
            base_dir: Base directory for cloning repos. Defaults to tmp_repos/
        """
        self.base_dir = Path(base_dir) if base_dir else Path(DEFAULT_REPOS_DIR)

    def get_repository_path(self) -> Path | None:
        """
        Get the path to a repository from environment variable.

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        env_path = os.environ.get(ENV_VAR_NAME)

        if env_path:
            path = Path(env_path)
            if path.exists():
                logger.info("Using repository from %s: %s", ENV_VAR_NAME, path)
                return path
            else:
                logger.warning(
                    "Environment variable %s points to non-existent path: %s",
                    ENV_VAR_NAME,
                    env_path,
                )

        return None

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
            self._clone_repository(repo_path)
        else:
            logger.info("Updating configuration repository at %s", repo_path)
            self._pull_latest(repo_path)

        return repo_path

    def _clone_repository(self, target_path: Path) -> None:
        """
        Clone the repository.

        Args:
            target_path: Where to clone the repository

        Raises:
            RuntimeError: If cloning fails
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            subprocess.run(
                ["git", "clone", REPO_URL, str(target_path)],
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully cloned configuration repository")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to clone configuration repository: {e.stderr}") from e

    def _pull_latest(self, repo_path: Path) -> None:
        """
        Pull latest changes from remote.

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
                ["git", "pull"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully pulled latest changes at %s", repo_path)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to pull latest changes: {e.stderr}") from e
