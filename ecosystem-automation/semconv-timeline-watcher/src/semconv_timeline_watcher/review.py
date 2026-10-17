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

"""Render and upsert maintainer review issues. Reviews never accept anything by themselves.

Everything interpolated from upstream text, hand-edited files or error output is neutralised
(``@mentions`` cannot ping anyone) and the body is capped below GitHub's size limit.
"""

import json
import logging
import re
from pathlib import PurePosixPath

from .accepted import AcceptedHistory
from .state import COMPLETE, REGISTRY_DIR, stem
from .validation import record_problems

logger = logging.getLogger(__name__)

LABEL = "semantic-convention-timeline"
TIMELINE_FILE = "ecosystem-explorer/public/data/semantic-conventions/timeline.json"
MAX_BODY = 60000  # GitHub rejects issue bodies above 65,536 characters
_MENTION = re.compile(r"@(?=[\w-])")


def safe(text: object) -> str:
    """Make untrusted text inert in an issue: no mentions, no raw HTML comments, single line."""
    return _MENTION.sub("@​", str(text)).replace("<!--", "<!​--").replace("\n", " ")


def marker(review_key: str) -> str:
    return f"<!-- semconv-timeline-review: {review_key} -->"


def title(key: str) -> str:
    return f"[semconv timeline] Review {key}"


def record_file(source: str, key: str) -> str:
    """Where the candidate file lives in the repository, whatever directory the run read it from."""
    return str(PurePosixPath(REGISTRY_DIR) / source / "candidates" / f"{stem(key)}.json")


def _cap(body: str) -> str:
    if len(body) <= MAX_BODY:
        return body
    return body[:MAX_BODY] + "\n\n_Truncated: the candidate file has the full evidence._\n"


def source_coverage(accepted: AcceptedHistory, source: str, src_state: dict | None) -> dict:
    """What is covered for a source: accepted mark, completed-run end, and the pending head if any."""
    through = (accepted.reviewed_through(source) or {}).get("commit")
    revisions = (src_state or {}).get("revisions", {})
    cursor = (src_state or {}).get("cursor")
    covered = revisions[cursor]["commit"] if cursor and cursor in revisions else through
    pending = [r for r in revisions.values() if r.get("status") != COMPLETE]
    heads = [r["commit"] for r in pending if r.get("kind") == "range" and not r.get("manual") and r.get("commit")]
    return {"covered": covered, "head": heads[-1] if heads else None, "pending": len(pending)}


def _comparable(accepted: AcceptedHistory, lane: str | None, kind: str) -> str:
    events = [e for e in accepted.events.values() if e["lane"] == lane and e["type"] == kind]
    events = events or [e for e in accepted.events.values() if e["type"] == kind]
    return f"`{sorted(e['id'] for e in events)[0]}`" if events else "an existing event of the same type"


def move_sections(record: dict, accepted: AcceptedHistory, coverage: dict) -> list[str]:
    """For lanes that moved between sources: where the destination stands and what is still uncovered."""
    source = record["source"]
    touched = {c["lane"] for c in record["candidates"] if c["lane"]}
    lines: list[str] = []
    for lane in accepted.lanes:
        move = lane.get("migration")
        if not move or not (lane["id"] in touched or source in (move["from"], move["to"])):
            continue
        dest = accepted.sources.get(move["to"], {})
        through = (dest.get("reviewedThrough") or {}).get("commit")
        info = coverage.get(move["to"]) or {}
        covered = info.get("covered") or through
        lines += [
            "",
            f"### Move: {safe(lane['title'])} (`{move['eventId']}`)",
            "",
            f"- `{move['from']}` → `{move['to']}`; the move itself is already accepted history.",
            f"- Destination monitoring: `{dest.get('mode', 'unknown')}`-mode source; accepted coverage through "
            f"`{(through or 'nothing')[:12]}`; {info.get('pending', 0)} revision(s) not yet reviewed.",
        ]
        if info.get("head"):
            lines.append(
                f"- Uncovered interval: `{(covered or '')[:12]}..{info['head'][:12]}` is extracted but "
                "not yet reviewed; "
                "later commits are not extracted until the next run."
            )
        else:
            lines.append(
                f"- Uncovered interval: everything after `{(covered or 'the start')[:12]}` until the destination "
                "has been processed (nothing is extracted for it yet)."
            )
        if source == move["from"]:
            lines.append("- Changes to this lane's old definitions are not proposed here.")
        if source == move["to"]:
            lines.append(
                "- Definitions imported before the move are not candidates; the range starts at the reviewed boundary."
            )
    return lines


def render_body(
    record: dict,
    status: str,
    accepted: AcceptedHistory,
    revision_state: dict,
    file: str,
    coverage: dict | None = None,
) -> str:
    source = accepted.sources[record["source"]]
    through = accepted.reviewed_through(record["source"]) or {}
    covered = through.get("tag") or (through.get("commit") or "nothing")[:12]
    baseline = f"`{record['baselineCommit']}`" + (f" ({record['baselineTag']})" if record.get("baselineTag") else "")
    lines = [
        marker(record["reviewKey"]),
        f"## Review `{record['reviewKey']}`",
        "",
        "Generated by `semconv-timeline-watcher`. Nothing here is accepted: candidates become history only when a "
        "maintainer edits `timeline.json` and records a disposition below.",
        "",
        "| | |",
        "| --- | --- |",
        f"| Source | [{record['source']}]({source['repository']}) |",
        f"| Revision | `{record['commit']}`" + (f" ({record['tag']})" if record.get("tag") else "") + " |",
        f"| Compared with | {baseline if record['baselineCommit'] else '_no baseline found_'} |",
        f"| Date | {record['date']} (basis: `{record['dateBasis']}`) |",
        f"| Processing status | **{status}** |",
        f"| Accepted-history coverage (`reviewedThrough`) | {covered}; a pending review does not move it |",
    ]
    if record.get("compareUrl"):
        lines.append(f"| Comparison | {record['compareUrl']} |")
    if revision_state.get("tagChanged"):
        change = revision_state["tagChanged"]
        lines += [
            "",
            "### Tag changed upstream",
            "",
            f"The tag now resolves to `{change['current']}`, previously `{change['previous']}`. Accepted history was "
            "not touched"
            + (" and this review had been completed against the old commit" if status == COMPLETE else "")
            + ". Decide whether the earlier extraction still holds, then replay with "
            f"`--source {record['source']} --tag {record.get('tag', '<tag>')} --force`; dispositions are kept only for "
            "candidates whose evidence is unchanged.",
        ]
    reset = record.get("resetReviews")
    if reset:
        lines += [
            "",
            "### Earlier dispositions were reset",
            "",
            f"The revision changed from `{reset['fromCommit']}`, so "
            + (
                f"the earlier `noMilestone` ({safe(reset['noMilestone'].get('reason', ''))!r}) and "
                if reset.get("noMilestone")
                else ""
            )
            + f"{len(reset['candidates'])} candidate disposition(s) no longer apply; "
            "the new evidence needs its own review.",
        ]
    lines += ["", "### Candidates", ""]
    if not record["candidates"]:
        lines.append(
            "_No candidates were extracted._ This is **not** a verified absence of changes if any gap below says "
            "the extraction was incomplete."
        )
    for candidate in record["candidates"]:
        lines += [
            f"- [ ] `{candidate['id']}`: {safe(candidate['transition'])} (lane `{candidate['lane']}`, proposed type "
            f"`{candidate['proposedType']}`, {candidate['scope']['changed']} of "
            f"{candidate['scope']['total']} subjects)",
            *(f"  - {safe(reason)}" for reason in candidate["reasons"]),
            *(f"  - ⚠ {safe(warning)}" for warning in candidate["warnings"][1:]),
            *(f"  - [{safe(link['label'])}]({link['url']})" for link in candidate["evidence"]),
        ]
        if candidate["subjects"]:
            lines.append("  - subjects: " + ", ".join(f"`{safe(s)}`" for s in candidate["subjects"]))
    lines += ["", "### Extraction gaps and ambiguities", ""]
    lines += [f"- **{gap['kind']}**: {safe(gap['message'])}" for gap in record["gaps"]] or ["- none recorded"]
    structure = (record.get("method") or {}).get("structure") or {}
    if structure:
        lines += [
            "",
            f"Not proposed as milestones: {structure['groupsAdded']} group id(s) added and "
            f"{structure['groupsRemoved']} removed (reorganisation), "
            f"{structure['subjectsAddedToExistingNamespaces']} new subject(s) in existing namespaces.",
        ]
    lines += move_sections(record, accepted, coverage or {})
    if record["kind"] == "range":
        lines += ["", f"### Commits ({len(record['relevantCommits'])} relevant)", ""]
        lines += [f"- `{c['commit'][:12]}` {safe(c['subject'])}" for c in record["relevantCommits"]]
    lines += [
        "",
        "### Record a disposition",
        "",
        f"Edit `{file}` (generated by the automation PR on `otelbot/automated-semconv-timeline-*`; merge that PR "
        f"first) and, to accept, add the event to `{TIMELINE_FILE}`. Comparable accepted event: "
        + (
            _comparable(accepted, record["candidates"][0]["lane"], record["candidates"][0]["proposedType"])
            if record["candidates"]
            else "none; see `EVENT-AUDIT.md`"
        )
        + ".",
        "",
        "```json",
        json.dumps({"disposition": {"status": "accepted", "eventId": "<id in timeline.json>"}}, indent=2),
        json.dumps({"disposition": {"status": "excluded", "reason": "<why this is not a timeline event>"}}, indent=2),
        json.dumps({"noMilestone": {"reason": "<what was reviewed and why nothing qualifies>"}}, indent=2),
        "```",
        "",
        "Closing this issue does not complete the review: the revision is complete only when every candidate is "
        "accepted or excluded with a reason, or `noMilestone` is recorded. To advance coverage, also move "
        f"`reviewedThrough` in `{TIMELINE_FILE}` in the same PR.",
        "",
        "Validate and preview:",
        "",
        "```sh",
        "uv run semconv-timeline-watcher check",
        "cd ecosystem-explorer && bun run test && bun run dev",
        "```",
    ]
    return _cap("\n".join(lines) + "\n")


def render_failure_body(key: str, source: str, revision_state: dict, accepted: AcceptedHistory, detail: str) -> str:
    """A review item for a revision that could not be extracted or whose candidate file is unusable."""
    repository = accepted.sources.get(source, {}).get("repository", "")
    commit = revision_state.get("commit")
    lines = [
        marker(key),
        f"## Extraction failed for `{key}`",
        "",
        "Generated by `semconv-timeline-watcher`. This revision has **no usable candidates**, so its range is "
        '**not covered**: do not read the absence of candidates as "no changes". Accepted history was not modified.',
        "",
        "| | |",
        "| --- | --- |",
        f"| Source | [{source}]({repository}) |" if repository else f"| Source | {safe(source)} |",
        "| Revision | "
        + (f"`{commit}`" if commit else "_unresolved_")
        + (f" ({revision_state['tag']})" if revision_state.get("tag") else "")
        + " |",
        "| Processing status | **failed** |",
        "",
        "### Error",
        "",
        "```text",
        safe(detail)[:1500],
        "```",
        "",
        "### What to do",
        "",
        "- Check the workflow run log for the full traceback.",
        "- If the tag or commit is missing locally, confirm the upstream release exists, then re-run "
        f"`Nightly Semantic Convention Timeline Discovery` for `{source}` with `force`.",
        "- If a candidate file is reported invalid, fix its JSON (see the package README) or delete it to regenerate "
        "(dispositions in it are then lost).",
        "- Or record the outcome by hand: a revision with no candidate file can still be reviewed after a successful "
        "re-run.",
        "",
        "```sh",
        f"uv run semconv-timeline-watcher run --source {source} --force",
        "```",
    ]
    return _cap("\n".join(lines) + "\n")


def render_reconcile_body(entry: dict, source: str, accepted: AcceptedHistory) -> str:
    repository = accepted.sources[source]["repository"]
    return _cap(
        "\n".join(
            [
                marker(f"{entry['key']}#tag-moved"),
                f"## Accepted release tag moved: `{entry['key']}`",
                "",
                "Generated by `semconv-timeline-watcher`. Accepted history was **not** modified.",
                "",
                f"- Source: [{source}]({repository})",
                f"- Accepted commit (`timeline.json`): `{entry['expected']}`",
                f"- The tag now resolves to: `{entry['actual']}`",
                "",
                "Decide whether the accepted event(s) citing this release still hold. If upstream re-tagged on "
                f"purpose, update the release `commit` in `{TIMELINE_FILE}` in a reviewed change; otherwise raise it "
                "upstream. `uv run semconv-timeline-watcher check` fails until the tag and the accepted commit agree.",
            ]
        )
        + "\n"
    )


def _needs_review(item: dict) -> bool:
    if item["kind"] == "reconcile":
        return True
    return item["status"] != COMPLETE or bool(item["state"].get("tagChanged"))


def _record_defects(item: dict, accepted: AcceptedHistory) -> str | None:
    """Why the record cannot be rendered, or None. Nothing is defaulted or guessed."""
    record = item["record"]
    if record is None:
        return None
    problems = record_problems(record)
    if not problems:
        if record["source"] != item["source"] or record["reviewKey"] != item["key"]:
            problems.append(f"record is for {record['reviewKey']}, not {item['key']}")
        if record["source"] not in accepted.sources:
            problems.append(f"record names unknown source {record['source']!r}")
    return "; ".join(problems)[:1500] or None


def _body(item: dict, accepted: AcceptedHistory) -> str:
    if item["kind"] == "reconcile":
        return render_reconcile_body(item["entry"], item["source"], accepted)
    state = item["state"]
    detail = state.get("error") or state.get("invalid") or _record_defects(item, accepted)
    if item["record"] is None or detail:
        return render_failure_body(
            item["key"], item["source"], state, accepted, detail or "no candidate file was produced"
        )
    return render_body(
        item["record"], item["status"], accepted, state, record_file(item["source"], item["key"]), item.get("coverage")
    )


def item_key(item: dict) -> str:
    return f"{item['key']}#tag-moved" if item["kind"] == "reconcile" else item["key"]


def _upsert_one(client, repo: str, item: dict, accepted: AcceptedHistory) -> tuple[str, str]:
    body, key = _body(item, accepted), item_key(item)
    existing = client.find_issue(repo, marker(key), LABEL)
    if existing is None:
        suffix = " (tag moved)" if item["kind"] == "reconcile" else ""
        client.create_issue(repo, title(item["key"]) + suffix, body, [LABEL])
        return key, "created"
    number, action = existing["number"], "unchanged"
    if (existing.get("body") or "") != body:
        client.update_issue(repo, number, body=body)
        action = "updated"
    if existing.get("state") == "closed":
        client.update_issue(repo, number, state="open")
        client.comment(
            repo,
            number,
            "Reopened: this still needs a maintainer. Record the dispositions or resolve the problem described above.",
        )
        action = "reopened"
    return key, action


def upsert_reviews(client, repo: str, items: list[dict], accepted: AcceptedHistory) -> list[tuple[str, str]]:
    """Create or update one issue per revision that needs a maintainer. Returns ``(key, action)`` pairs.

    Items are ``{kind: "revision"|"reconcile", key, source, ...}``. The hidden marker is the identity,
    so reruns and overlapping workflows update the same issue (a failure and its later success share one);
    a closed issue whose review is still needed is reopened. Each item is isolated: one that cannot be
    rendered or published is reported as ``failed: <reason>`` and the rest are still processed. Nothing
    about a failed item is marked reviewed or completed.
    """
    actions = []
    for item in sorted((i for i in items if _needs_review(i)), key=item_key):
        try:
            actions.append(_upsert_one(client, repo, item, accepted))
        except Exception as e:  # noqa: BLE001 - one bad item must not stop the others
            logger.exception("Could not publish the review for %s", item_key(item))
            actions.append((item_key(item), f"failed: {type(e).__name__}: {e}"))
    return actions
