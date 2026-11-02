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
#

"""Carry pending candidate files from the automation branch into a discovery run.

The shared sync workflow checks out the default branch, runs the watcher and force-pushes the automation
branch. Candidates that were proposed earlier but not yet merged (including manual replays) live only on
that branch, so without this step the next run would replace them.

The branch is read as *data*: files are listed and read with ``git ls-tree`` and ``git show``, parsed as
JSON, validated with the same rules as any candidate file, and written through ``Store.write_record``.
Nothing from the branch is imported or executed. A record that already exists on the default branch is
never replaced (a merged record is authoritative); every other valid record is kept.
"""

import json
import logging
import subprocess
from pathlib import Path

from watcher_common.repository_manager import GIT

from .accepted import AcceptedHistory
from .gitrepo import REF_RE, GitError
from .state import Store, stem
from .validation import record_problems

logger = logging.getLogger(__name__)


def _git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([GIT, *args], cwd=root, capture_output=True, text=True, encoding="utf-8", check=False)  # noqa: S603


def _relative(store: Store, root: Path) -> str:
    return store.dir.resolve().relative_to(root.resolve()).as_posix()


def _fetch(root: Path, branch: str, remote: str) -> bool:
    """Fetch the branch. False if it does not exist yet; any other failure raises, never silently drops work."""
    if not REF_RE.match(branch):
        raise GitError(f"invalid branch name: {branch!r}")
    listed = _git(root, "ls-remote", "--exit-code", "--heads", remote, branch)
    if listed.returncode == 2:  # git's documented "no matching refs" status
        return False
    if listed.returncode != 0:
        raise GitError(f"cannot list {remote}/{branch}: {listed.stderr.strip()}")
    fetched = _git(root, "fetch", "--quiet", remote, f"+refs/heads/{branch}:refs/remotes/{remote}/{branch}")
    if fetched.returncode != 0:
        raise GitError(f"cannot fetch {remote}/{branch}: {fetched.stderr.strip()}")
    return True


def _entry(record: dict) -> dict:
    """The state entry a carried record needs; derived from the validated record, not read from the branch."""
    entry = {"kind": record["kind"], "source": record["source"], "commit": record["commit"]}
    if record["kind"] == "range" and not record["reviewKey"].endswith(".."):
        entry["manual"] = True  # a closed range is an explicit replay, outside the cursor's run
    if record.get("tag"):
        entry["tag"] = record["tag"]
    return entry


def carry_pending(
    store: Store,
    source: str,
    branch: str,
    accepted: AcceptedHistory,
    root: Path | str = ".",
    remote: str = "origin",
) -> dict[str, dict]:
    """Copy valid, not-yet-present candidate files from *branch* into *store*; return their state entries."""
    root = Path(root)
    if not _fetch(root, branch, remote):
        return {}
    ref, base = f"refs/remotes/{remote}/{branch}", _relative(store, root)
    tree = _git(root, "ls-tree", "-r", "--name-only", ref, "--", f"{base}/candidates/")
    if tree.returncode != 0:
        raise GitError(f"cannot list candidates on {branch}: {tree.stderr.strip()}")
    carried: dict[str, dict] = {}
    for path in sorted(p for p in tree.stdout.splitlines() if p.endswith(".json")):
        shown = _git(root, "show", f"{ref}:{path}")
        try:
            if shown.returncode != 0:
                raise ValueError(shown.stderr.strip())
            record = json.loads(shown.stdout)
            problems = record_problems(record)
            key = record.get("reviewKey") if isinstance(record, dict) else None
            if not problems and (record["source"] != source or not key.startswith(f"{source}@")):
                problems = [f"belongs to {record['source']!r}, not {source!r}"]
            if not problems and Path(path).stem != stem(key):
                problems = [f"reviewKey {key!r} does not match the file name"]
        except ValueError as e:  # includes JSONDecodeError
            problems = [str(e)]
        if problems:
            logger.warning("Not carrying %s from %s: %s", path, branch, "; ".join(problems))
            continue
        if store.record_path(source, key).exists() or key in accepted.releases:
            continue  # already merged, or accepted since: the default branch is authoritative
        store.write_record(record)
        carried[key] = _entry(record)
        logger.info("Carried pending %s from %s", key, branch)
    return carried
