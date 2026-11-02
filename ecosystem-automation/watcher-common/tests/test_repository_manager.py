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

"""Tests for the shared git runner."""

import subprocess

import pytest
from watcher_common.repository_manager import run_git
from watcher_common.testing import init_repo


def test_run_git_returns_stdout(tmp_path):
    init_repo(tmp_path)
    assert run_git("rev-parse", "--is-inside-work-tree", cwd=tmp_path) == "true\n"


def test_run_git_wraps_failure_with_stderr(tmp_path):
    init_repo(tmp_path)
    with pytest.raises(ValueError, match="Failed to checkout nope: .*nope") as raised:
        run_git("checkout", "nope", cwd=tmp_path, error="Failed to checkout nope", error_type=ValueError)
    assert isinstance(raised.value.__cause__, subprocess.CalledProcessError)


def test_run_git_without_error_propagates_called_process_error(tmp_path):
    init_repo(tmp_path)
    with pytest.raises(subprocess.CalledProcessError):
        run_git("checkout", "nope", cwd=tmp_path)
