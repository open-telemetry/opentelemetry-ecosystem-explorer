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

"""Read-only git access to a local clone, with immutable-revision helpers."""

import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from watcher_common.repository_manager import _GIT

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
# Refs a caller may pass for a manual range: no leading dash, no whitespace or shell syntax.
REF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$")


class GitError(RuntimeError):
    """A git command failed or a ref could not be resolved."""


class GitRepo:
    """Thin wrapper over the git CLI. Never writes to the repository."""

    def __init__(self, path: Path | str):
        self.path = Path(path)

    def _run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(  # noqa: S603
            [_GIT, *args], cwd=self.path, capture_output=True, text=True, check=False
        )
        if check and result.returncode != 0:
            raise GitError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
        return result

    def resolve(self, ref: str) -> str:
        """Resolve *ref* to a full commit SHA, or raise GitError."""
        if not REF_RE.match(ref) and not SHA_RE.match(ref):
            raise GitError(f"invalid ref: {ref!r}")
        result = self._run("rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}", check=False)
        sha = result.stdout.strip()
        if result.returncode != 0 or not SHA_RE.match(sha):
            raise GitError(f"cannot resolve {ref!r} to a commit")
        return sha

    def tag_commit(self, tag: str) -> str:
        return self.resolve(f"refs/tags/{tag}")

    def is_ancestor(self, ancestor: str, descendant: str) -> bool:
        return self._run("merge-base", "--is-ancestor", ancestor, descendant, check=False).returncode == 0

    def distance(self, ancestor: str, descendant: str) -> int:
        return int(self._run("rev-list", "--count", f"{ancestor}..{descendant}").stdout.strip())

    def commit_date(self, sha: str) -> str:
        """The committer date of *sha* as an ISO date in UTC."""
        iso = self._run("log", "-1", "--format=%cI", sha).stdout.strip()
        return datetime.fromisoformat(iso).astimezone(UTC).date().isoformat()

    def list_files(self, rev: str, prefix: str) -> list[str]:
        out = self._run("ls-tree", "-r", "--name-only", rev, "--", prefix, check=False).stdout
        return sorted(line for line in out.splitlines() if line)

    def show(self, rev: str, path: str) -> str | None:
        result = self._run("show", f"{rev}:{path}", check=False)
        return result.stdout if result.returncode == 0 else None

    def changed_paths(self, base: str, rev: str, paths: list[str]) -> list[str]:
        out = self._run("diff", "--name-only", base, rev, "--", *paths).stdout
        return sorted(line for line in out.splitlines() if line)

    def commits(self, base: str, rev: str, paths: list[str]) -> list[tuple[str, str]]:
        """First-parent commits in ``base..rev`` touching *paths*, oldest first, as (sha, subject)."""
        out = self._run(
            "log", "--first-parent", "--reverse", "--format=%H%x09%s", f"{base}..{rev}", "--", *paths
        ).stdout
        return [tuple(line.split("\t", 1)) for line in out.splitlines() if line]  # type: ignore[misc]
