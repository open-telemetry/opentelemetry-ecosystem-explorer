"""Manages OpenTelemetry Collector repository setup and access.

Handles cloning, updating, and accessing collector repositories based on
environment variables or default locations.
"""

import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

from semantic_version import Version

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

DEFAULT_REPOS_DIR = "tmp_repos"


class RepositoryManager:
    """Manages OpenTelemetry Collector repository locations and setup."""

    def __init__(self, base_dir: Optional[str] = None):
        """
        Args:
            base_dir: Base directory for cloning repos. Defaults to tmp_repos/
        """
        self.base_dir = Path(base_dir) if base_dir else Path(DEFAULT_REPOS_DIR)

    def get_repository_path(self, distribution: DistributionName) -> Optional[Path]:
        """
        Get the path to a repository from environment variable.

        Args:
            distribution: The distribution name (core or contrib)

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        env_var = ENV_VAR_NAMES[distribution]
        env_path = os.environ.get(env_var)

        if env_path:
            path = Path(env_path)
            if path.exists():
                logger.info("Using repository from %s: %s", env_var, path)
                return path
            else:
                logger.warning(
                    "Environment variable %s points to non-existent path: %s",
                    env_var,
                    env_path,
                )

        return None

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
            self._clone_repository(distribution, repo_path)
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

    def _clone_repository(self, distribution: DistributionName, target_path: Path) -> None:
        """
        Clone a repository.

        Args:
            distribution: The distribution name
            target_path: Where to clone the repository

        Raises:
            RuntimeError: If cloning fails
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)
        url = REPO_URLS[distribution]

        try:
            subprocess.run(
                ["git", "clone", url, str(target_path)],
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully cloned %s repository", distribution)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to clone {distribution} repository: {e.stderr}") from e

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
