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

"""Build the candidate record for one source revision or revision range."""

from pathlib import PurePosixPath

from . import changelog
from .accepted import AcceptedHistory
from .extract import EXTRACTOR, extract_candidates
from .gitrepo import GitRepo
from .model_diff import take_snapshot

RECORD_SCHEMA_VERSION = 1
_MAX_COMMITS = 50


def release_spec(
    *,
    source: str,
    repository: str,
    tag: str,
    commit: str,
    date: str,
    baseline_tag: str | None,
    baseline_commit: str | None,
) -> dict:
    """A published release compared with its nearest ancestor release."""
    return {
        "reviewKey": f"{source}@{tag}",
        "source": source,
        "kind": "release",
        "tag": tag,
        "commit": commit,
        "baselineCommit": baseline_commit,
        "baselineTag": baseline_tag,
        "date": date,
        "dateBasis": "release-published-at",
        "repository": repository,
    }


def range_spec(*, source: str, repository: str, base: str, commit: str, date: str, open_ended: bool) -> dict:
    """A commit range of a source without releases; dated by the head commit's UTC committer date."""
    suffix = "" if open_ended else commit[:12]
    return {
        "reviewKey": f"{source}@{base[:12]}..{suffix}",
        "source": source,
        "kind": "range",
        "commit": commit,
        "baselineCommit": base,
        "baselineTag": None,
        "date": date,
        "dateBasis": "commit-date",
        "repository": repository,
        "manual": not open_ended,  # an explicit replay range, kept out of the cursor's contiguous run
    }


def compare_url(spec: dict) -> str | None:
    if not spec["baselineCommit"]:
        return None
    return f"{spec['repository']}/compare/{spec['baselineCommit']}...{spec['commit']}"


def build_record(spec: dict, repo: GitRepo, accepted: AcceptedHistory, paths: list[str]) -> dict:
    """Extract candidates for *spec*. Missing evidence becomes a gap, never a silent no-change."""
    gaps: list[dict] = []
    candidates: list[dict] = []
    method: dict = {"extractor": EXTRACTOR, "filesParsed": 0, "filesUnparsed": []}
    structure: dict = {}
    base = spec["baselineCommit"]
    entries: list[dict] = []
    relevant: list[dict] = []

    if base is None:
        gaps.append(
            {
                "kind": "incomplete",
                "message": "No baseline release is an ancestor of this revision; nothing was compared.",
            }
        )
    else:
        before, after = take_snapshot(repo, base), take_snapshot(repo, spec["commit"])
        method["filesParsed"] = after.parsed
        method["filesUnparsed"] = sorted(set(before.unparsed) | set(after.unparsed))
        if method["filesUnparsed"]:
            gaps.append(
                {
                    "kind": "incomplete",
                    "message": f"{len(method['filesUnparsed'])} model file(s) could not be parsed, so their "
                    "changes are not covered.",
                }
            )
        if after.parsed == 0:
            gaps.append({"kind": "incomplete", "message": "No model files were parsed at this revision."})

        if spec["kind"] == "release":
            text = repo.show(spec["commit"], "CHANGELOG.md")
            parsed = changelog.parse_changelog_section(text, spec["tag"].lstrip("v")) if text else None
            if parsed is None:
                gaps.append(
                    {"kind": "incomplete", "message": f"No CHANGELOG section for {spec['tag']} was found at the tag."}
                )
            else:
                entries = parsed
        else:
            for path in repo.changed_paths(base, spec["commit"], ["changelog.d"]):
                fragment_text = repo.show(spec["commit"], path)
                if fragment_text is not None and (
                    entry := changelog.parse_fragment(PurePosixPath(path).name, fragment_text, spec["repository"])
                ):
                    entries.append(entry)
            commits = repo.commits(base, spec["commit"], paths)
            relevant = [{"commit": sha, "subject": subject} for sha, subject in commits[:_MAX_COMMITS]]
            method["relevantCommitCount"] = len(commits)

        found = extract_candidates(
            source_id=spec["source"],
            review_key=spec["reviewKey"],
            repository=spec["repository"],
            sha=spec["commit"],
            before=before,
            after=after,
            entries=entries,
            lanes=accepted.lanes,
        )
        candidates, structure = found["candidates"], found["structure"]
        gaps += found["gaps"]

    record = {
        "schemaVersion": RECORD_SCHEMA_VERSION,
        "reviewKey": spec["reviewKey"],
        "source": spec["source"],
        "kind": spec["kind"],
        "commit": spec["commit"],
        "baselineCommit": base,
        "date": spec["date"],
        "dateBasis": spec["dateBasis"],
        "compareUrl": compare_url(spec),
        "method": {**method, "structure": structure},
        "gaps": sorted(gaps, key=lambda g: (g["kind"], g["message"])),
        "incomplete": any(g["kind"] == "incomplete" for g in gaps),
        "candidates": candidates,
        "noMilestone": None,
    }
    if spec.get("tag"):
        record["tag"] = spec["tag"]
    if spec.get("baselineTag"):
        record["baselineTag"] = spec["baselineTag"]
    if spec["kind"] == "range":
        record["relevantCommits"] = relevant
        record["changelogFragments"] = [e["text"] for e in entries]
    return record
