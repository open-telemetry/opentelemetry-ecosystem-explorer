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

from watcher_common.repository_manager import _GIT


class VersionDetector:
    """Detects versions in OpenTelemetry git repositories."""

    def __init__(self, repo_path: str | Path):
        """Args:
            repo_path: Path to the git repository

        Raises:
            ValueError: If repository path does not exist
        """
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

    def _list_tags(self) -> list[str]:
        """Return all tag names in the repository."""
        result = subprocess.run(
            [_GIT, "tag", "--list"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
            text=True,
        )
        return [line for line in result.stdout.splitlines() if line]

    def _parse_release_versions(self) -> list[Version]:
        """Parse all tag names into non-prerelease Version objects, ignoring invalid tags."""
        versions = []
        for tag_name in self._list_tags():
            try:
                # Strip 'v' prefix from tag name (e.g., "v0.112.0" -> "0.112.0")
                version = Version(tag_name.lstrip("v"))
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
        # Git tags have 'v' prefix (e.g., "v0.112.0")
        tag_name = f"v{version}"
        try:
            subprocess.run(
                [_GIT, "checkout", tag_name],
                cwd=self.repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise ValueError(f"Failed to checkout {tag_name}: {e.stderr}") from e

    def checkout_main(self) -> None:
        """Checkout the main branch.

        Raises:
            ValueError: If main doesn't exist
        """
        try:
            subprocess.run(
                [_GIT, "checkout", "main"],
                cwd=self.repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise ValueError(f"Failed to checkout main branch: {e.stderr}") from e

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
            [_GIT, "show", f"{ref}:{rel_path}"],
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

    def determine_next_snapshot_version(self) -> Version:
        """Determine the next snapshot version based on latest release.

        Returns the next patch version after the latest release.
        For example, if the latest release is v0.112.0, this returns v0.112.1-SNAPSHOT.

        Returns:
            Next snapshot version
        """
        latest = self.get_latest_release_tag()
        if latest is None:
            return Version(major=0, minor=0, patch=1, prerelease=("SNAPSHOT",))

        # Create snapshot version (increment patch)
        return Version(
            major=latest.major,
            minor=latest.minor,
            patch=latest.patch + 1,
            prerelease=("SNAPSHOT",),
        )
