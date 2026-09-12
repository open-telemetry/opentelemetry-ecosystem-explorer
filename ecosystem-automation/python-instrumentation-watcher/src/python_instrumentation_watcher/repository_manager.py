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

"""Repository manager for opentelemetry-python-contrib."""

import logging
from pathlib import Path

from watcher_common.repository_manager import BaseRepositoryManager

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/open-telemetry/opentelemetry-python-contrib.git"
REPO_ENV_VAR = "PYTHON_CONTRIB_REPO_PATH"
REPO_NAME = "opentelemetry-python-contrib"


class PythonContribRepositoryManager(BaseRepositoryManager):
    """Manages the opentelemetry-python-contrib repository."""

    def setup(self) -> Path:
        """
        Set up the python-contrib repository — clone if not present, pull if it is.

        Checks PYTHON_CONTRIB_REPO_PATH env var first, then falls back to
        cloning into tmp_repos/opentelemetry-python-contrib.

        Returns:
            Path to the repository root
        """
        existing = self._get_repository_path(REPO_ENV_VAR)
        if existing:
            return existing

        repo_path = self.base_dir / REPO_NAME

        if repo_path.exists():
            logger.info("Pulling latest changes for python-contrib...")
            self._pull_latest(repo_path)
        else:
            logger.info("Cloning opentelemetry-python-contrib...")
            self._clone_repository(REPO_URL, repo_path)

        return repo_path
