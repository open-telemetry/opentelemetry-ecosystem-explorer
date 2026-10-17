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

"""Per-source discovery → extraction → candidate records → processing state.

Each source runs in isolation: an exception in one leaves the other's state untouched, and a failed
source never rewrites its own previous state. Accepted history (``timeline.json``) is read-only here.
"""

import copy
import logging

from . import discovery, revisions
from .accepted import AcceptedHistory
from .gitrepo import GitError, GitRepo
from .state import Store, cursor_of, merge_dispositions, record_status
from .validation import InvalidFileError

logger = logging.getLogger(__name__)

CORE = "semantic-conventions"
GENAI = "semantic-conventions-genai"


def empty_source_state() -> dict:
    return {"cursor": None, "order": [], "reconcile": [], "revisions": {}}


def _repository(accepted: AcceptedHistory, source: str) -> str:
    return accepted.sources[source]["repository"]


def _slug(accepted: AcceptedHistory, source: str) -> str:
    return _repository(accepted, source).removeprefix("https://github.com/")


def refresh_statuses(store: Store, accepted: AcceptedHistory, src: dict) -> dict:
    """Recompute every revision's status, the order and the cursor from the candidate files.

    Maintainer edits to a record's dispositions take effect here; no network is needed.
    """
    dates = {}
    for key, revision in src["revisions"].items():
        revision.pop("invalid", None)
        try:
            record = store.read_record(revision["source"], key)
        except InvalidFileError as e:  # a hand-edited file that no longer parses: this revision fails, others do not
            record = None
            revision["invalid"] = "; ".join(e.problems)[:1500]
        failed = revision.get("error") or revision.get("invalid")
        revision["status"] = "failed" if failed else record_status(record, accepted)
        dates[key] = record["date"] if record else ""
    # A manual replay of an arbitrary range is evidence to review, but never part of the cursor's run.
    src["order"] = sorted((k for k, r in src["revisions"].items() if not r.get("manual")), key=lambda k: (dates[k], k))
    src["cursor"] = cursor_of(src["order"], src["revisions"])
    return src


def _process_spec(
    store: Store, repo: GitRepo, accepted: AcceptedHistory, spec: dict, src: dict, paths: list[str], force: bool
) -> str:
    """Extract and store one revision unless it is unchanged. Returns what happened."""
    key, current = spec["reviewKey"], src["revisions"].get(spec["reviewKey"])
    try:
        previous = store.read_record(spec["source"], key)
    except InvalidFileError as e:
        # Never regenerate over a file a maintainer may have edited; surface it instead.
        if current:
            current["invalid"] = "; ".join(e.problems)[:1500]
        return "failed"
    if current and previous and not force:
        if current["commit"] == spec["commit"] and not current.get("error"):
            return "unchanged"
        if spec["kind"] == "release" and current["commit"] != spec["commit"]:
            # A published tag moved: report it for reconciliation instead of silently re-extracting.
            current["tagChanged"] = {"previous": current["commit"], "current": spec["commit"]}
            return "tag-changed"
    try:
        record = merge_dispositions(previous, revisions.build_record(spec, repo, accepted, paths))
        store.write_record(record)  # validated first: an invalid record fails this revision and keeps the old file
    except Exception as e:  # noqa: BLE001 - recorded per revision; other revisions still run
        logger.exception("Extraction failed for %s", key)
        if current:
            current["error"] = str(e)
        else:
            src["revisions"][key] = {
                "kind": spec["kind"],
                "source": spec["source"],
                "commit": spec["commit"],
                "error": str(e),
            }
        return "failed"
    entry = {"kind": spec["kind"], "source": spec["source"], "commit": spec["commit"]}
    if spec.get("manual"):
        entry["manual"] = True
    if spec.get("tag"):
        entry["tag"] = spec["tag"]
    src["revisions"][key] = entry
    return "updated" if previous else "created"


def process_core(
    store: Store, accepted: AcceptedHistory, repo: GitRepo, client, state_src: dict, opts: dict
) -> tuple[dict, dict]:
    src = refresh_statuses(store, accepted, copy.deepcopy(state_src))  # pick up maintainers' edits first
    repository, slug = _repository(accepted, CORE), _slug(accepted, CORE)
    paths = accepted.sources[CORE]["paths"]
    releases = discovery.published_releases(client, slug)
    commits, errors = discovery.resolve_tags(repo, [r["tag"] for r in releases])
    by_tag = {r["tag"]: r for r in releases}
    report = {"discovered": len(releases), "actions": {}, "unresolvable": errors}

    # Accepted releases whose tag now resolves elsewhere: reported, never rewritten.
    src["reconcile"] = sorted(
        (
            {"key": key, "expected": rel["commit"], "actual": commits[rel["key"].split("@", 1)[1]]}
            for key, rel in accepted.releases.items()
            if key.startswith(f"{CORE}@")
            and rel.get("commit")
            and commits.get(rel["key"].split("@", 1)[1], rel["commit"]) != rel["commit"]
        ),
        key=lambda r: r["key"],
    )

    if opts.get("from_ref"):
        targets = [("range", None)]
    elif opts.get("tag"):
        if opts["tag"] not in by_tag:
            raise ValueError(f"{opts['tag']} is not a published release of {CORE}")
        targets = [("release", opts["tag"])]
    else:
        accepted_keys = accepted.accepted_release_keys(CORE)
        targets = [("release", t) for t in by_tag if f"{CORE}@{t}" not in accepted_keys]
    force = bool(opts.get("force") or opts.get("tag") or opts.get("from_ref"))

    for kind, tag in targets:
        if kind == "range":
            base, head = repo.resolve(opts["from_ref"]), repo.resolve(opts["to_ref"])
            spec = revisions.range_spec(
                source=CORE,
                repository=repository,
                base=base,
                commit=head,
                date=repo.commit_date(head),
                open_ended=False,
            )
        else:
            if tag in errors:
                src["revisions"][f"{CORE}@{tag}"] = {
                    "kind": "release",
                    "source": CORE,
                    "commit": "",
                    "error": errors[tag],
                    "tag": tag,
                }
                report["actions"][f"{CORE}@{tag}"] = "failed"
                continue
            base_tag, base_commit = discovery.nearest_ancestor_release(repo, commits[tag], commits, tag)
            spec = revisions.release_spec(
                source=CORE,
                repository=repository,
                tag=tag,
                commit=commits[tag],
                date=by_tag[tag]["publishedAt"][:10],
                baseline_tag=base_tag,
                baseline_commit=base_commit,
            )
        report["actions"][spec["reviewKey"]] = _process_spec(store, repo, accepted, spec, src, paths, force)
    return refresh_statuses(store, accepted, src), report


def process_genai(
    store: Store, accepted: AcceptedHistory, repo: GitRepo, state_src: dict, opts: dict, head_ref: str
) -> tuple[dict, dict]:
    src = refresh_statuses(store, accepted, copy.deepcopy(state_src))  # pick up maintainers' edits first
    repository = _repository(accepted, GENAI)
    paths = accepted.sources[GENAI]["paths"]
    report = {"actions": {}}
    head = repo.resolve(opts.get("to_ref") or head_ref)  # a mutable branch becomes an immutable SHA here

    if opts.get("from_ref"):
        base, open_ended, force = repo.resolve(opts["from_ref"]), False, True
    else:
        # Start after whichever is later: the end of the completed run or the accepted coverage mark.
        base = accepted.reviewed_through(GENAI)["commit"]
        cursor_commit = src["revisions"][src["cursor"]]["commit"] if src["cursor"] else None
        if cursor_commit and cursor_commit != base and repo.is_ancestor(base, cursor_commit):
            base = cursor_commit
        open_ended, force = True, bool(opts.get("force"))
    if base != head and not repo.is_ancestor(base, head):
        raise GitError(f"{base[:12]} is not an ancestor of {head[:12]}; upstream history was rewritten")
    if not repo.commits(base, head, paths):
        report["actions"]["no-relevant-changes"] = f"nothing under {', '.join(paths)} since {base[:12]}"
        return refresh_statuses(store, accepted, src), report
    spec = revisions.range_spec(
        source=GENAI, repository=repository, base=base, commit=head, date=repo.commit_date(head), open_ended=open_ended
    )
    prior = src["revisions"].get(spec["reviewKey"])
    if prior and prior["commit"] != head and not force:
        force = True  # the open-ended range simply grew to the new head
    report["actions"][spec["reviewKey"]] = _process_spec(store, repo, accepted, spec, src, paths, force)
    return refresh_statuses(store, accepted, src), report
