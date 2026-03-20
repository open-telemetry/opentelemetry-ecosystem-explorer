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
"""Version detection for OpenTelemetry configuration repository."""

from pathlib import Path

import git
from semantic_version import Version


class VersionDetector:
    """Detects versions in the OpenTelemetry configuration repository."""

    def __init__(self, repo_path: str | Path):
        """Args:
            repo_path: Path to the git repository

        Raises:
            ValueError: If repository path does not exist
        """
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

        self.repo = git.Repo(str(self.repo_path))

    def get_latest_release_tag(self) -> Version | None:
        """Get the latest release tag from the repository.

        Returns:
            Latest version tag, or None if no valid tags found
        """
        tags = self.repo.tags
        version_tags = []

        for tag in tags:
            try:
                version = Version(tag.name.lstrip("v"))
                if not version.prerelease:
                    version_tags.append(version)
            except ValueError:
                continue

        if not version_tags:
            return None

        return max(version_tags)

    def checkout_version(self, version: Version) -> None:
        """Checkout a specific version tag.

        Args:
            version: Version to checkout

        Raises:
            ValueError: If version tag doesn't exist
        """
        tag_name = f"v{version}"
        try:
            self.repo.git.checkout(tag_name)
        except git.exc.GitCommandError as e:
            raise ValueError(f"Failed to checkout {tag_name}: {e}") from e

    def checkout_main(self) -> None:
        """Checkout the main branch.

        Raises:
            ValueError: If main doesn't exist
        """
        try:
            self.repo.git.checkout("main")
        except git.exc.GitCommandError as e:
            raise ValueError(f"Failed to checkout main branch: {e}") from e

    def determine_next_snapshot_version(self) -> Version:
        """Determine the next snapshot version based on latest release.

        Returns the next patch version after the latest release.
        For example, if the latest release is v1.0.0, this returns v1.0.1-SNAPSHOT.

        Returns:
            Next snapshot version
        """
        latest = self.get_latest_release_tag()
        if latest is None:
            return Version(major=0, minor=0, patch=1, prerelease=("SNAPSHOT",))

        snapshot_version = Version(
            major=latest.major,
            minor=latest.minor,
            patch=latest.patch + 1,
            prerelease=("SNAPSHOT",),
        )
        return snapshot_version
