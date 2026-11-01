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
"""Version detection for OpenTelemetry git repositories."""

import subprocess
from pathlib import Path

from semantic_version import Version

from watcher_common.repository_manager import GIT, run_git


class VersionDetector:
    """Detects versions in OpenTelemetry git repositories."""

    def __init__(self, repo_path: str | Path, tag_prefix: str = "v"):
        """Args:
            repo_path: Path to the git repository
            tag_prefix: Exact release tag prefix, e.g. v or browser-instrumentation-v

        Raises:
            ValueError: If repository path does not exist
        """
        self.tag_prefix = tag_prefix
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

    def fetch_tags(self) -> None:
        """Fetch release tags, including tags added since the last watcher run.

        Raises:
            ValueError: If git fetch fails. The message includes git's stderr,
                matching checkout_version, because capture_output otherwise hides
                the cause from the nightly log.
        """
        run_git("fetch", "origin", "--tags", cwd=self.repo_path, error="Failed to fetch tags", error_type=ValueError)

    def _list_tags(self) -> list[str]:
        """Return all tag names in the repository."""
        return [line for line in run_git("tag", "--list", cwd=self.repo_path).splitlines() if line]

    def _parse_release_versions(self) -> list[Version]:
        """Parse all tag names into non-prerelease Version objects, ignoring invalid tags."""
        versions = []
        for tag_name in self._list_tags():
            try:
                if tag_name.startswith(self.tag_prefix):
                    version = Version(tag_name.removeprefix(self.tag_prefix))
                elif self.tag_prefix == "v":
                    version = Version(tag_name)
                else:
                    continue
                if not version.prerelease:
                    versions.append(version)
            except ValueError:
                continue
        return versions

    def get_latest_release_tag(self) -> Version | None:
        """Get the latest release tag from the repository.

        Returns:
            Latest version tag, or None if no valid tags found
        """
        versions = self._parse_release_versions()
        return max(versions) if versions else None

    def get_all_release_tags(self) -> list[Version]:
        """Get all release tags from the repository, sorted newest to oldest.

        Returns:
            List of version tags
        """
        return sorted(self._parse_release_versions(), reverse=True)

    def checkout_version(self, version: Version) -> None:
        """Checkout a specific version tag.

        Args:
            version: Version to checkout

        Raises:
            ValueError: If version tag doesn't exist
        """
        # Match the configured component prefix when checking out a release.
        tag_name = f"{self.tag_prefix}{version}"
        run_git("checkout", tag_name, cwd=self.repo_path, error=f"Failed to checkout {tag_name}", error_type=ValueError)

    def checkout_main(self) -> None:
        """Checkout the main branch.

        Raises:
            ValueError: If main doesn't exist
        """
        run_git("checkout", "main", cwd=self.repo_path, error="Failed to checkout main branch", error_type=ValueError)

    def read_file_at_ref(self, ref: str, rel_path: str) -> str | None:
        """Return the text content of ``rel_path`` at git ``ref``.

        Reads the blob directly via ``git show`` without touching the working
        tree, so the result depends only on ``ref`` — not on whatever revision
        the repository is currently checked out to. This makes it safe to read a
        file at one version while the clone is checked out to another (e.g.
        resolving a per-version schema during a multi-version backfill).

        Args:
            ref: Git ref to read from (tag like ``v0.145.0``, branch like
                ``main``, or any commit-ish).
            rel_path: Repository-relative path to the file.

        Returns:
            The file's text content, or None if ``ref`` does not exist or the
            file is absent at that ref.
        """
        result = subprocess.run(
            [GIT, "show", f"{ref}:{rel_path}"],
            cwd=self.repo_path,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0:
            return None
        return result.stdout
