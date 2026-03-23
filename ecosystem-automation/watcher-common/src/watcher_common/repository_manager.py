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
"""Base repository management for git repository setup and access.

Handles cloning, updating, and checking out repositories based on
environment variables or default locations.
"""

import logging
import os
import subprocess
from pathlib import Path

from semantic_version import Version

logger = logging.getLogger(__name__)

DEFAULT_REPOS_DIR = "tmp_repos"


class BaseRepositoryManager:
    """Base class for git repository management.

    Provides common clone, pull, and checkout operations.
    Subclasses configure the specific repo URL, env var name, and repo name,
    and may override _pull_latest for repo-specific git strategies.
    """

    def __init__(self, base_dir: str | None = None):
        """
        Args:
            base_dir: Base directory for cloning repos. Defaults to tmp_repos/
        """
        self.base_dir = Path(base_dir) if base_dir else Path(DEFAULT_REPOS_DIR)

    def get_repository_path(self, env_var_name: str) -> Path | None:
        """
        Get the path to a repository from an environment variable.

        Args:
            env_var_name: Name of the environment variable holding the repo path

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        env_path = os.environ.get(env_var_name)

        if env_path:
            path = Path(env_path)
            if path.exists():
                logger.info("Using repository from %s: %s", env_var_name, path)
                return path
            else:
                logger.warning(
                    "Environment variable %s points to non-existent path: %s",
                    env_var_name,
                    env_path,
                )

        return None

    def _clone_repository(self, url: str, target_path: Path) -> None:
        """
        Clone a repository from the given URL.

        Args:
            url: Git remote URL to clone from
            target_path: Where to clone the repository

        Raises:
            RuntimeError: If cloning fails
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            subprocess.run(
                ["git", "clone", url, str(target_path)],
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully cloned repository to %s", target_path)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to clone repository from {url}: {e.stderr}") from e

    def _pull_latest(self, repo_path: Path) -> None:
        """
        Pull latest changes from remote.

        Args:
            repo_path: Path to the repository

        Raises:
            RuntimeError: If pull fails
        """
        try:
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

    def _checkout_version(self, repo_path: Path, version: Version) -> None:
        """
        Checkout a specific version tag.

        Args:
            repo_path: Path to the repository
            version: Version to checkout

        Raises:
            RuntimeError: If checkout fails
        """
        # Git tags have 'v' prefix (e.g., "v0.112.0")
        tag = f"v{version}"
        try:
            subprocess.run(
                ["git", "fetch", "--tags"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "checkout", tag],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully checked out %s at %s", tag, repo_path)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to checkout version {tag}: {e.stderr}") from e
