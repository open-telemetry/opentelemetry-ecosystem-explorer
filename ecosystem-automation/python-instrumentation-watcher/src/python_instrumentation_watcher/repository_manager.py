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
import re
import subprocess
from pathlib import Path

from watcher_common.repository_manager import _GIT, BaseRepositoryManager

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/open-telemetry/opentelemetry-python-contrib.git"
REPO_ENV_VAR = "PYTHON_CONTRIB_REPO_PATH"
REPO_NAME = "opentelemetry-python-contrib"

# Matches the repo-wide lockstep release tag shape every other watcher in this
# repository already assumes (bare "v<version>", e.g. "v0.65b0") — not a
# per-package independent-release tag, which python-contrib also has a growing
# number of. See _checkout_latest_release.
_RELEASE_TAG_RE = re.compile(r"^v\d")


class PythonContribRepositoryManager(BaseRepositoryManager):
    """Manages the opentelemetry-python-contrib repository."""

    def setup(self) -> Path:
        """
        Set up the python-contrib repository — clone if not present, pull if it is —
        then check out the most recent repo-wide release tag.

        Checks PYTHON_CONTRIB_REPO_PATH env var first, then falls back to cloning
        into tmp_repos/opentelemetry-python-contrib. An env-var override is used
        exactly as given, without touching its checkout — matching every other
        watcher's "trust the caller's local path" contract — so only the managed
        clone/pull path below checks out a release tag; see
        _checkout_latest_release for why that's necessary.

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

        self._checkout_latest_release(repo_path)

        return repo_path

    def _checkout_latest_release(self, repo_path: Path) -> None:
        """
        Check out the most recent repo-wide release tag, reusing
        BaseRepositoryManager._checkout_version for the actual checkout rather than
        implementing another checkout mechanism.

        `main`'s version.py always reports an unreleased development version (e.g.
        "0.66.0.dev") that never changes between releases. Reading `__version__`
        from that checkout (PackageParser._resolve_version) would make every
        package look like it's permanently at that same version, so
        InventoryManager.version_exists() would treat every subsequent nightly run
        as already tracked and the registry would never advance past its first
        sync. Checking out an actual release tag first makes `__version__` resolve
        to the real released string for each package instead — version resolution
        itself needs no change; it already reads directly from whatever is on disk.

        This deliberately does not use `semantic_version`-based tag parsing
        (watcher_common.version_detector.VersionDetector, or
        BaseRepositoryManager._checkout_version's own `Version` type hint):
        python-contrib's release tags are PEP 440-style (e.g. "v0.65b0"), which
        `semantic_version.Version` cannot parse — every tag would raise ValueError
        and be silently skipped, so none would ever be found. Tags are instead
        listed and ordered by actual git tag creation date, never by parsing or
        comparing the version numbers in their names, and restricted to the bare
        "v<version>" shape the repo-wide lockstep release line uses, since
        python-contrib also has a growing number of packages that tag their own
        independent releases separately — those don't identify a single, coherent
        state of the whole tree to scan the way a repo-wide release tag does.

        If no matching tag is found, the working tree is left as-is (whatever
        `main` currently is) rather than failing the run.
        """
        try:
            result = subprocess.run(
                [_GIT, "tag", "--list", "--sort=-creatordate"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to list tags for python-contrib: {e.stderr}") from e

        tag = next((t for t in result.stdout.splitlines() if _RELEASE_TAG_RE.match(t)), None)
        if tag is None:
            logger.warning("No release tag found for python-contrib at %s; using current checkout", repo_path)
            return

        logger.info("Checking out latest python-contrib release tag: %s", tag)
        # _checkout_version only ever interpolates `version` into an f-string
        # (f"v{version}") — it never calls a semantic_version.Version-specific
        # method — so passing the tag's raw version suffix reuses its exact
        # fetch+checkout mechanics without needing a Version object PEP 440
        # strings like "0.65b0" can't construct.
        self._checkout_version(repo_path, tag.removeprefix("v"))
