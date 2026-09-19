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

"""Scanner for Python instrumentation packages in the python-contrib repository."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

INSTRUMENTATION_DIR = "instrumentation"
PACKAGE_PREFIX = "opentelemetry-instrumentation-"


class PackageScanner:
    """
    Scans the python-contrib repository for instrumentation packages.

    Discovers all instrumentation/opentelemetry-instrumentation-* directories.
    Deliberately scans only `instrumentation/`, not `instrumentation-genai/` —
    the GenAI instrumentation area is a separate ecosystem effort (see
    projects/135-python-instrumentation/01-metadata-audit.md, "Boundary Note").
    """

    def __init__(self, repo_path: Path):
        """
        Args:
            repo_path: Path to the cloned opentelemetry-python-contrib repository
        """
        self.repo_path = repo_path

    def discover_packages(self) -> list[Path]:
        """
        Discover all instrumentation package directories.

        Returns:
            Sorted list of paths to instrumentation package directories
            that have a pyproject.toml
        """
        instrumentation_dir = self.repo_path / INSTRUMENTATION_DIR
        if not instrumentation_dir.exists():
            logger.warning("instrumentation/ directory not found at %s", instrumentation_dir)
            return []

        found = []
        for item in sorted(instrumentation_dir.iterdir()):
            if not item.is_dir():
                continue
            if not item.name.startswith(PACKAGE_PREFIX):
                continue
            if not (item / "pyproject.toml").exists():
                logger.debug("Skipping %s — no pyproject.toml", item.name)
                continue
            found.append(item)

        logger.info("Found %d instrumentation packages", len(found))
        return found
