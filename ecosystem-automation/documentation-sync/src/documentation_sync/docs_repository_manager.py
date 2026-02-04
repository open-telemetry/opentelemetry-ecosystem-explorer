"""Manages opentelemetry.io repository setup and access.

Handles cloning, updating, and accessing the documentation repository based on
environment variables or default locations.
"""

import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DOCS_REPO_URL = "https://github.com/open-telemetry/opentelemetry.io.git"
DOCS_REPO_ENV_VAR = "OTEL_DOCS_REPO_PATH"
DEFAULT_REPOS_DIR = "tmp_repos"


class DocsRepositoryManager:
    """Manages opentelemetry.io repository location and setup."""

    def __init__(self, base_dir: Optional[str] = None):
        """
        Args:
            base_dir: Base directory for cloning repos. Defaults to tmp_repos/
        """
        self.base_dir = Path(base_dir) if base_dir else Path(DEFAULT_REPOS_DIR)

    def get_repository_path(self) -> Optional[Path]:
        """
        Get the path to the docs repository from environment variable.

        Returns:
            Path if environment variable is set and path exists, None otherwise
        """
        env_path = os.environ.get(DOCS_REPO_ENV_VAR)

        if env_path:
            path = Path(env_path)
            if path.exists():
                logger.info("Using repository from %s: %s", DOCS_REPO_ENV_VAR, path)
                return path
            else:
                logger.warning(
                    "Environment variable %s points to non-existent path: %s",
                    DOCS_REPO_ENV_VAR,
                    env_path,
                )

        return None

    def setup_repository(self, update: bool = True) -> Path:
        """
        Set up the docs repository by cloning or using existing location.

        If an environment variable is set, use that path.
        Otherwise, clone to base_dir if needed.

        Args:
            update: Whether to pull latest changes for existing repos

        Returns:
            Path to the repository

        Raises:
            RuntimeError: If setup fails
        """
        env_path = self.get_repository_path()
        if env_path:
            if update:
                logger.info("Updating opentelemetry.io repository at %s", env_path)
                self._pull_latest(env_path)
            return env_path

        repo_path = self.base_dir / "opentelemetry.io"

        if not repo_path.exists():
            logger.info("Cloning opentelemetry.io repository to %s", repo_path)
            self._clone_repository(repo_path)
        elif update:
            logger.info("Updating opentelemetry.io repository at %s", repo_path)
            self._pull_latest(repo_path)

        return repo_path

    def _clone_repository(self, target_path: Path) -> None:
        """
        Clone the documentation repository.

        Args:
            target_path: Where to clone the repository

        Raises:
            RuntimeError: If cloning fails
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            subprocess.run(
                ["git", "clone", DOCS_REPO_URL, str(target_path)],
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info("Successfully cloned opentelemetry.io repository")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to clone opentelemetry.io repository: {e.stderr}") from e

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
