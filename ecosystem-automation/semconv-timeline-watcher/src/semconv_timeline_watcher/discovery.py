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

"""Release and commit-range discovery. Every revision is resolved to an immutable commit SHA."""

import logging

from .gitrepo import GitError, GitRepo

logger = logging.getLogger(__name__)


def published_releases(client, repo: str) -> list[dict]:
    """Published, non-draft, non-prerelease releases as ``{tag, publishedAt}``.

    Selection and order do not depend on API ordering: duplicates collapse by tag, and the result
    is sorted by publication time, then tag.
    """
    found: dict[str, dict] = {}
    for release in client.releases(repo):
        if release.get("draft") or release.get("prerelease") or not release.get("published_at"):
            continue
        found[release["tag_name"]] = {"tag": release["tag_name"], "publishedAt": release["published_at"]}
    return sorted(found.values(), key=lambda r: (r["publishedAt"], r["tag"]))


def resolve_tags(git: GitRepo, tags: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    """Tag → commit SHA for every resolvable tag, and tag → error for the rest."""
    commits, errors = {}, {}
    for tag in tags:
        try:
            commits[tag] = git.tag_commit(tag)
        except GitError as e:
            errors[tag] = str(e)
    return commits, errors


def nearest_ancestor_release(
    git: GitRepo, commit: str, release_commits: dict[str, str], skip_tag: str
) -> tuple[str, str] | tuple[None, None]:
    """The release tag whose commit is the closest ancestor of *commit*.

    Not the previous version number and not the previous API entry: a patch cut from a release
    branch (e.g. v1.41.1) is not an ancestor of the next minor release, whose baseline is v1.41.0.
    """
    best: tuple[int, str, str] | None = None
    for tag, sha in release_commits.items():
        if tag == skip_tag or sha == commit or not git.is_ancestor(sha, commit):
            continue
        key = (git.distance(sha, commit), tag, sha)
        if best is None or key < best:
            best = key
    return (best[1], best[2]) if best else (None, None)


def coalesce(git: GitRepo, ranges: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Merge overlapping or touching ``(base, head)`` ranges of one linear history.

    Ranges that are separated by an unreviewed gap stay separate, so coverage is never overstated.
    """
    pending = sorted(set(ranges))
    changed = True
    while changed:
        changed = False
        for i in range(len(pending)):
            for j in range(i + 1, len(pending)):
                (a, b), (c, d) = pending[i], pending[j]
                if git.is_ancestor(a, d) and git.is_ancestor(c, b):  # they overlap or touch
                    low = a if git.is_ancestor(a, c) else c
                    high = b if git.is_ancestor(d, b) else d
                    pending[i] = (low, high)
                    del pending[j]
                    changed = True
                    break
            if changed:
                break
    return sorted(pending)
