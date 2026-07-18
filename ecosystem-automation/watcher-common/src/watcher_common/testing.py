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
"""Shared git helpers for watcher test suites."""

import subprocess
from pathlib import Path

from watcher_common.repository_manager import _GIT


def run_git(path: Path, *args: str) -> str:
    """Run a git command in *path* and return stripped stdout."""
    try:
        return subprocess.run(
            [_GIT, *args],
            cwd=path,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except subprocess.CalledProcessError as e:
        e.add_note(e.stderr.strip())
        raise


def init_repo(path: Path) -> None:
    """Initialise a git repo at *path* with a fixed local user identity.

    Sets per-repo config to prevent global settings (e.g. commit.gpgsign) from
    slowing down or breaking test fixtures.
    """
    run_git(path, "init")
    run_git(path, "config", "user.email", "test@example.com")
    run_git(path, "config", "user.name", "Test User")
    # Override global commit.gpgsign so test commits don't invoke GPG.
    run_git(path, "config", "commit.gpgsign", "false")


def git_commit(path: Path, message: str) -> None:
    """Create a commit with *message* in *path*."""
    run_git(path, "commit", "--no-verify", "--no-gpg-sign", "-m", message)
