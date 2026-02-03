"""Version detection for OpenTelemetry Collector repositories."""

from pathlib import Path

import git
from semantic_version import Version


class VersionDetector:
    """Detects versions in OpenTelemetry Collector repositories."""

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
                # Strip 'v' prefix from tag name (e.g., "v0.112.0" -> "0.112.0")
                version = Version(tag.name.lstrip("v"))
                if not version.prerelease:
                    version_tags.append(version)
            except ValueError:
                continue

        if not version_tags:
            return None

        return max(version_tags)

    def get_all_release_tags(self) -> list[Version]:
        """Get all release tags from the repository, sorted newest to oldest.

        Returns:
            List of version tags
        """
        tags = self.repo.tags
        version_tags = []

        for tag in tags:
            try:
                # Strip 'v' prefix from tag name (e.g., "v0.112.0" -> "0.112.0")
                version = Version(tag.name.lstrip("v"))
                if not version.prerelease:
                    version_tags.append(version)
            except ValueError:
                continue

        return sorted(version_tags, reverse=True)

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
        For example, if the latest release is v0.112.0, this returns v0.112.1-SNAPSHOT.

        Returns:
            Next snapshot version
        """
        latest = self.get_latest_release_tag()
        if latest is None:
            return Version(major=0, minor=0, patch=1, prerelease=("SNAPSHOT",))

        # Create snapshot version (increment patch)
        snapshot_version = Version(
            major=latest.major,
            minor=latest.minor,
            patch=latest.patch + 1,
            prerelease=("SNAPSHOT",),
        )
        return snapshot_version
