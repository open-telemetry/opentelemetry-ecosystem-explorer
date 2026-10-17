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

"""Test default and component-specific release tag detection."""

from semantic_version import Version
from watcher_common.testing import git_commit, init_repo, run_git
from watcher_common.version_detector import VersionDetector


def test_prefix_is_exact_and_checkout_uses_it(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "file").write_text("release")
    run_git(tmp_path, "add", ".")
    git_commit(tmp_path, "test: release")
    for tag in ["1.0.0", "v1.2.3", "vv2.0.0", "browser-v0.8.1", "browser-v0.9.0-rc.1", "sdk-v9.0.0"]:
        run_git(tmp_path, "tag", tag)
    assert VersionDetector(tmp_path).get_all_release_tags() == [Version("1.2.3"), Version("1.0.0")]
    detector = VersionDetector(tmp_path, tag_prefix="browser-v")
    assert detector.get_latest_release_tag() == Version("0.8.1")
    (tmp_path / "file").write_text("unreleased")
    run_git(tmp_path, "add", ".")
    git_commit(tmp_path, "test: unreleased changes")
    detector.checkout_version(Version("0.8.1"))
    assert (tmp_path / "file").read_text() == "release"
