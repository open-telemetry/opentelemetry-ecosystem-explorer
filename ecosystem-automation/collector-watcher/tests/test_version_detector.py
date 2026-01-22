"""Tests for version detector."""

from pathlib import Path

import git
import pytest
from collector_watcher.version import Version
from collector_watcher.version_detector import VersionDetector


@pytest.fixture
def temp_git_repo(tmp_path):
    """Create a temporary git repository with some version tags."""
    repo_path = tmp_path / "test_repo"
    repo_path.mkdir()

    repo = git.Repo.init(repo_path)

    test_file = repo_path / "test.txt"
    test_file.write_text("initial content")
    repo.index.add(["test.txt"])
    repo.index.commit("Initial commit")

    repo.create_tag("v0.110.0")

    test_file.write_text("update 1")
    repo.index.add(["test.txt"])
    repo.index.commit("Update 1")
    repo.create_tag("v0.111.0")

    test_file.write_text("update 2")
    repo.index.add(["test.txt"])
    repo.index.commit("Update 2")
    repo.create_tag("v0.112.0")

    # Add a snapshot tag (should be ignored in release detection)
    test_file.write_text("update 3")
    repo.index.add(["test.txt"])
    repo.index.commit("Update 3")
    repo.create_tag("v0.113.0-SNAPSHOT")

    # Add an invalid tag (should be ignored)
    repo.create_tag("not-a-version")

    return repo_path


@pytest.fixture
def empty_git_repo(tmp_path):
    """Create an empty git repository with no tags."""
    repo_path = tmp_path / "empty_repo"
    repo_path.mkdir()

    repo = git.Repo.init(repo_path)

    test_file = repo_path / "test.txt"
    test_file.write_text("initial")
    repo.index.add(["test.txt"])
    repo.index.commit("Initial commit")

    return repo_path


class TestVersionDetector:
    def test_init_valid_path(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        assert detector.repo_path == Path(temp_git_repo)
        assert detector.repo is not None

    def test_init_invalid_path(self, tmp_path):
        invalid_path = tmp_path / "nonexistent"
        with pytest.raises(ValueError, match="Repository path does not exist"):
            VersionDetector(invalid_path)

    def test_get_latest_release_tag(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        latest = detector.get_latest_release_tag()

        assert latest is not None
        assert latest == Version(0, 112, 0)

    def test_get_latest_release_tag_empty_repo(self, empty_git_repo):
        """Test getting latest tag from a repo with no tags."""
        detector = VersionDetector(empty_git_repo)
        latest = detector.get_latest_release_tag()

        assert latest is None

    def test_get_latest_release_tag_ignores_snapshots(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        latest = detector.get_latest_release_tag()

        # Should be v0.112.0, not v0.113.0-SNAPSHOT
        assert latest == Version(0, 112, 0)
        assert not latest.is_snapshot

    def test_get_all_release_tags(self, temp_git_repo):
        """Test getting all release tags sorted newest to oldest."""
        detector = VersionDetector(temp_git_repo)
        tags = detector.get_all_release_tags()

        assert len(tags) == 3
        assert tags[0] == Version(0, 112, 0)
        assert tags[1] == Version(0, 111, 0)
        assert tags[2] == Version(0, 110, 0)

    def test_get_all_release_tags_ignores_snapshots_and_invalid(self, temp_git_repo):
        """Test that snapshot and invalid tags are excluded."""
        detector = VersionDetector(temp_git_repo)
        tags = detector.get_all_release_tags()

        # Should have 3 tags (v0.110.0, v0.111.0, v0.112.0)
        # Should not include v0.113.0-SNAPSHOT or "not-a-version"
        assert len(tags) == 3
        assert all(not tag.is_snapshot for tag in tags)

    def test_checkout_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version(0, 111, 0)

        detector.checkout_version(version)

        # Verify we're at the correct tag
        assert detector.repo.head.commit == detector.repo.tags["v0.111.0"].commit

    def test_checkout_version_invalid(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version(1, 0, 0)  # This tag doesn't exist

        with pytest.raises(ValueError, match="Failed to checkout"):
            detector.checkout_version(version)

    def test_checkout_main(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)

        # First checkout a tag
        detector.checkout_version(Version(0, 111, 0))

        # Then checkout main
        detector.checkout_main()

        current_branch = detector.repo.active_branch.name
        assert current_branch == "main"

    def test_determine_next_snapshot_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        next_version = detector.determine_next_snapshot_version()

        # Latest release is v0.112.0, so next snapshot should be v0.112.1-SNAPSHOT
        assert next_version.major == 0
        assert next_version.minor == 112
        assert next_version.patch == 1
        assert next_version.is_snapshot

    def test_determine_next_snapshot_version_empty_repo(self, empty_git_repo):
        """Test determining next snapshot version with no existing releases."""
        detector = VersionDetector(empty_git_repo)
        next_version = detector.determine_next_snapshot_version()

        # Should default to v0.0.1-SNAPSHOT
        assert next_version == Version(0, 0, 1, is_snapshot=True)
