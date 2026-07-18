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

    try:
        run_git(repo_path, "checkout", "-b", "main")
    except CalledProcessError:
        run_git(repo_path, "checkout", "main")

    run_git(repo_path, "tag", "v0.3.0")

    test_file.write_text("update 1")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 1")
    run_git(repo_path, "tag", "v0.4.0")

    test_file.write_text("update 2")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 2")
    run_git(repo_path, "tag", "v1.0.0")

    test_file.write_text("update 3")
    run_git(repo_path, "add", "test.txt")
    git_commit(repo_path, "Update 3")
    run_git(repo_path, "tag", "v1.0.1-SNAPSHOT")

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
        assert latest == Version("1.0.0")

    def test_get_latest_release_tag_empty_repo(self, empty_git_repo):
        detector = VersionDetector(empty_git_repo)
        latest = detector.get_latest_release_tag()

        assert latest is None

    def test_checkout_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version("0.4.0")

        detector.checkout_version(version)

        # Verify HEAD points to the same commit as the tag
        head_sha = run_git(temp_git_repo, "rev-parse", "HEAD")
        tag_sha = run_git(temp_git_repo, "rev-list", "-n", "1", "v0.4.0")
        assert head_sha == tag_sha

    def test_checkout_version_invalid(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        version = Version("9.9.9")

        with pytest.raises(ValueError, match="Failed to checkout"):
            detector.checkout_version(version)

    def test_checkout_main(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)

        detector.checkout_version(Version("0.4.0"))
        detector.checkout_main()

        current_branch = run_git(temp_git_repo, "branch", "--show-current")
        assert current_branch == "main"

    def test_determine_next_snapshot_version(self, temp_git_repo):
        detector = VersionDetector(temp_git_repo)
        next_version = detector.determine_next_snapshot_version()

        assert next_version.major == 1
        assert next_version.minor == 0
        assert next_version.patch == 1
        assert next_version.prerelease

    def test_determine_next_snapshot_version_empty_repo(self, empty_git_repo):
        detector = VersionDetector(empty_git_repo)
        next_version = detector.determine_next_snapshot_version()

        assert next_version == Version(major=0, minor=0, patch=1, prerelease=("SNAPSHOT",))
