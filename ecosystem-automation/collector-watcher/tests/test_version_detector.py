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
"""Tests for version detector."""

from pathlib import Path
from subprocess import CalledProcessError

import pytest
from semantic_version import Version
from watcher_common.testing import git_commit, init_repo, run_git
from watcher_common.version_detector import VersionDetector


@pytest.fixture
def temp_git_repo(tmp_path):
    """Create a temporary git repository with some version tags."""
    repo_path = tmp_path / "test_repo"
    repo_path.mkdir()
    init_repo(repo_path)

    test_file = repo_path / "test.txt"

    test_file.write_text("initial content")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Initial commit")

    # Ensure the branch is named "main" regardless of git's default.
    try:
        run_git(repo_path, "checkout", "-b", "main")
    except CalledProcessError:
        run_git(repo_path, "checkout", "main")

    run_git(repo_path, "tag", "v0.110.0")

    test_file.write_text("update 1")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 1")
    run_git(repo_path, "tag", "v0.111.0")

    test_file.write_text("update 2")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 2")
    run_git(repo_path, "tag", "v0.112.0")

    # Add a snapshot tag (should be ignored in release detection)
    test_file.write_text("update 3")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 3")
    run_git(repo_path, "tag", "v0.113.0-SNAPSHOT")

    # Add an invalid tag (should be ignored)
    run_git(repo_path, "tag", "not-a-version")

    return repo_path


@pytest.fixture
def empty_git_repo(tmp_path):
    """Create an empty git repository with no tags."""
    repo_path = tmp_path / "empty_repo"
    repo_path.mkdir()
    init_repo(repo_path)

    test_file = repo_path / "test.txt"
    test_file.write_text("initial")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Initial commit")

    try:
        run_git(repo_path, "checkout", "-b", "main")
    except CalledProcessError:
        run_git(repo_path, "checkout", "main")

    return repo_path


class TestVersionDetector:
    def test_init_valid_path(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        assert detector.repo_path == Path(temp_git_repo)

    def test_init_invalid_path(self, tmp_path):
        invalid_path = tmp_path / "nonexistent"
        with pytest.raises(ValueError, match="Repository path does not exist"):
            VersionDetector(invalid_path)

    def test_get_latest_release_tag(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        latest = detector.get_latest_release_tag()

        assert latest is not None
        assert latest == Version("0.112.0")

    def test_get_latest_release_tag_empty_repo(self, empty_git_repo):
        """Test getting latest tag from a repo with no tags."""
        detector = VersionDetector(empty_git_repo)
        latest = detector.get_latest_release_tag()

        assert latest is None

    def test_get_latest_release_tag_ignores_snapshots(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        latest = detector.get_latest_release_tag()

        # Should be v0.112.0, not v0.113.0-SNAPSHOT
        assert latest == Version("0.112.0")
        assert not latest.prerelease

    def test_get_all_release_tags(self, temp_git_repo):
        """Test getting all release tags sorted newest to oldest."""
        detector = VersionDetector(temp_git_repo)
        tags = detector.get_all_release_tags()

        assert len(tags) == 3
        assert tags[0] == Version("0.112.0")
        assert tags[1] == Version("0.111.0")
        assert tags[2] == Version("0.110.0")

    def test_get_all_release_tags_ignores_snapshots_and_invalid(self, temp_git_repo):
        """Test that snapshot and invalid tags are excluded."""
        detector = VersionDetector(temp_git_repo)
        tags = detector.get_all_release_tags()

        # Should have 3 tags (v0.110.0, v0.111.0, v0.112.0)
        # Should not include v0.113.0-SNAPSHOT or "not-a-version"
        assert len(tags) == 3
        assert all(not tag.prerelease for tag in tags)

    def test_checkout_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version("0.111.0")

        detector.checkout_version(version)

        # Verify HEAD points to the same commit as the tag
        head_sha = run_git(temp_git_repo, "rev-parse", "HEAD")
        tag_sha = run_git(temp_git_repo, "rev-list", "-n", "1", "v0.111.0")
        assert head_sha == tag_sha

    def test_checkout_version_invalid(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version("1.0.0")  # This tag doesn't exist

        with pytest.raises(ValueError, match="Failed to checkout"):
            detector.checkout_version(version)

    def test_checkout_main(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)

        # First checkout a tag
        detector.checkout_version(Version("0.111.0"))

        # Then checkout main
        detector.checkout_main()

        current_branch = run_git(temp_git_repo, "branch", "--show-current")
        assert current_branch == "main"

    def test_read_file_at_ref_returns_content_at_tag(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)

        # Each tag pins a different revision of test.txt.
        assert detector.read_file_at_ref("v0.110.0", "test.txt") == "initial content"
        assert detector.read_file_at_ref("v0.111.0", "test.txt") == "update 1"
        assert detector.read_file_at_ref("v0.112.0", "test.txt") == "update 2"

    def test_read_file_at_ref_does_not_change_checkout(self, temp_git_repo):
        """Reading an old ref must not disturb the working-tree checkout."""
        detector = VersionDetector(temp_git_repo)
        detector.checkout_main()

        content = detector.read_file_at_ref("v0.110.0", "test.txt")

        assert content == "initial content"
        # Still on main, working tree unchanged.
        assert run_git(temp_git_repo, "branch", "--show-current") == "main"
        assert (temp_git_repo / "test.txt").read_text() == "update 3"

    def test_read_file_at_ref_missing_path_returns_none(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        assert detector.read_file_at_ref("v0.110.0", "does/not/exist.yaml") is None

    def test_read_file_at_ref_missing_ref_returns_none(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        assert detector.read_file_at_ref("v9.9.9", "test.txt") is None

    def test_determine_next_snapshot_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        next_version = detector.determine_next_snapshot_version()

        # Latest release is v0.112.0, so next snapshot should be v0.112.1-SNAPSHOT
        assert next_version.major == 0
        assert next_version.minor == 112
        assert next_version.patch == 1
        assert next_version.prerelease

    def test_determine_next_snapshot_version_empty_repo(self, empty_git_repo):
        """Test determining next snapshot version with no existing releases."""
        detector = VersionDetector(empty_git_repo)
        next_version = detector.determine_next_snapshot_version()

        # Should default to v0.0.1-SNAPSHOT
        assert next_version == Version(major=0, minor=0, patch=1, prerelease=("SNAPSHOT",))
