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

"""Shape checks for hand-editable files (candidate records and processing state).

Maintainers edit candidate files and the state may be merged by hand, so nothing downstream may assume
a shape. These functions return actionable problems and never raise on malformed input.
"""

import re

SHA = re.compile(r"^[0-9a-f]{40}$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATE_BASES = ("release-published-at", "commit-date")
KINDS = ("release", "range")


class InvalidFileError(ValueError):
    """A stored file does not have the expected shape; ``problems`` lists each defect."""

    def __init__(self, path: object, problems: list[str]):
        self.path, self.problems = path, problems
        super().__init__(f"{path} is invalid: " + "; ".join(problems))


def _obj(value: object) -> bool:
    return isinstance(value, dict)


def _str(value: object) -> bool:
    return isinstance(value, str) and value != ""


def _check(problems: list[str], ok: bool, message: str) -> None:
    if not ok:
        problems.append(message)


def _strings(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _optional_str(record: dict, key: str, p: list[str]) -> None:
    _check(p, record.get(key) is None or isinstance(record[key], str), f"{key} must be a string when present")


def _record_extras(record: dict, p: list[str]) -> None:
    """Fields the review renderer reads beyond the core record: all must be well formed, never defaulted."""
    for key in ("tag", "baselineTag", "compareUrl"):
        _optional_str(record, key, p)
    structure = (record.get("method") or {}).get("structure") if _obj(record.get("method")) else None
    if structure is not None:
        names = ("groupsAdded", "groupsRemoved", "subjectsAddedToExistingNamespaces")
        _check(
            p,
            _obj(structure) and all(isinstance(structure.get(n), int) for n in names),
            f"method.structure needs integer {', '.join(names)}",
        )
    if record.get("kind") == "range":
        commits = record.get("relevantCommits")
        if not isinstance(commits, list):
            p.append("relevantCommits must be an array for a range record")
        else:
            for i, entry in enumerate(commits):
                ok = _obj(entry) and isinstance(entry.get("commit"), str) and isinstance(entry.get("subject"), str)
                _check(p, ok, f"relevantCommits[{i}] needs commit and subject strings")
    reset = record.get("resetReviews")
    if reset is not None:
        if not _obj(reset):
            p.append("resetReviews must be an object")
        else:
            _check(p, _str(reset.get("fromCommit")), "resetReviews.fromCommit must be a non-empty string")
            _check(p, _strings(reset.get("candidates")), "resetReviews.candidates must be an array of strings")
            earlier = reset.get("noMilestone")
            _check(p, earlier is None or _obj(earlier), "resetReviews.noMilestone must be an object or null")


def record_problems(record: object) -> list[str]:
    """Defects in a candidate record, or an empty list."""
    if not _obj(record):
        return ["record must be a JSON object"]
    p: list[str] = []
    _check(p, record.get("schemaVersion") == 1, "schemaVersion must be 1")
    for key in ("reviewKey", "source", "date"):
        _check(p, _str(record.get(key)), f"{key} must be a non-empty string")
    _check(p, record.get("kind") in KINDS, f"kind must be one of {', '.join(KINDS)}")
    _check(
        p,
        isinstance(record.get("commit"), str) and bool(SHA.match(record["commit"])),
        "commit must be a 40-character SHA",
    )
    base = record.get("baselineCommit")
    _check(p, base is None or (isinstance(base, str) and bool(SHA.match(base))), "baselineCommit must be a SHA or null")
    _check(p, isinstance(record.get("date"), str) and bool(ISO_DATE.match(record["date"])), "date must be YYYY-MM-DD")
    _check(p, record.get("dateBasis") in DATE_BASES, f"dateBasis must be one of {', '.join(DATE_BASES)}")
    _check(p, isinstance(record.get("incomplete"), bool), "incomplete must be a boolean")
    _check(p, _obj(record.get("method")), "method must be an object")

    gaps = record.get("gaps")
    if not isinstance(gaps, list):
        p.append("gaps must be an array")
    else:
        for i, gap in enumerate(gaps):
            _check(
                p, _obj(gap) and _str(gap.get("kind")) and _str(gap.get("message")), f"gaps[{i}] needs kind and message"
            )

    no_milestone = record.get("noMilestone")
    _check(p, no_milestone is None or _obj(no_milestone), "noMilestone must be an object or null")
    _record_extras(record, p)

    candidates = record.get("candidates")
    if not isinstance(candidates, list):
        p.append("candidates must be an array")
        return p
    seen: set[str] = set()
    for i, candidate in enumerate(candidates):
        at = f"candidates[{i}]"
        if not _obj(candidate):
            p.append(f"{at} must be an object")
            continue
        if _str(candidate.get("id")):
            at = f"candidates[{i}] ({candidate['id']})"  # name the candidate so the defect is findable
        _check(p, _str(candidate.get("id")), f"{at}.id must be a non-empty string")
        if candidate.get("id") in seen:
            p.append(f"{at}.id {candidate.get('id')!r} is duplicated")
        seen.add(str(candidate.get("id")))
        _check(p, _str(candidate.get("kind")), f"{at}.kind must be a non-empty string")
        _check(p, _str(candidate.get("transition")), f"{at}.transition must be a non-empty string")
        _check(p, _str(candidate.get("proposedType")), f"{at}.proposedType must be a non-empty string")
        lane = candidate.get("lane")
        _check(p, lane is None or _str(lane), f"{at}.lane must be a string or null")
        scope = candidate.get("scope")
        _check(
            p,
            _obj(scope) and isinstance(scope.get("changed"), int) and isinstance(scope.get("total"), int),
            f"{at}.scope needs integer changed and total",
        )
        for field in ("warnings", "reasons", "subjects"):
            _check(p, _strings(candidate.get(field)), f"{at}.{field} must be an array of strings")
        evidence = candidate.get("evidence")
        if not isinstance(evidence, list):
            p.append(f"{at}.evidence must be an array")
        else:
            for j, link in enumerate(evidence):
                ok = _obj(link) and _str(link.get("label")) and _str(link.get("url"))
                _check(p, ok, f"{at}.evidence[{j}] needs non-empty label and url")
        _check(p, isinstance(candidate.get("fromStates"), dict), f"{at}.fromStates must be an object")
        disposition = candidate.get("disposition")
        if disposition is not None and not _obj(disposition):
            p.append(f"{at}.disposition must be an object or null")
    return p


def state_problems(state: object) -> list[str]:
    """Defects in ``state.json``, or an empty list."""
    if not _obj(state):
        return ["state must be a JSON object"]
    p: list[str] = []
    _check(p, state.get("schemaVersion") == 1, f"unsupported schemaVersion {state.get('schemaVersion')!r}")
    sources = state.get("sources")
    if not _obj(sources):
        return [*p, "sources must be an object"]
    for name, src in sources.items():
        at = f"sources.{name}"
        if not _obj(src):
            p.append(f"{at} must be an object")
            continue
        cursor = src.get("cursor")
        _check(p, cursor is None or _str(cursor), f"{at}.cursor must be a string or null")
        _check(
            p,
            isinstance(src.get("order"), list) and all(isinstance(k, str) for k in src["order"]),
            f"{at}.order must be an array of strings",
        )
        reconcile = src.get("reconcile")
        if not isinstance(reconcile, list):
            p.append(f"{at}.reconcile must be an array")
        else:
            for i, item in enumerate(reconcile):
                ok = _obj(item) and all(_str(item.get(k)) for k in ("key", "expected", "actual"))
                _check(p, ok, f"{at}.reconcile[{i}] needs key, expected and actual")
        revisions = src.get("revisions")
        if not _obj(revisions):
            p.append(f"{at}.revisions must be an object")
            continue
        for key, revision in revisions.items():
            rat = f"{at}.revisions[{key}]"
            if not _obj(revision):
                p.append(f"{rat} must be an object")
                continue
            _check(p, revision.get("kind") in KINDS, f"{rat}.kind must be one of {', '.join(KINDS)}")
            _check(p, _str(revision.get("source")), f"{rat}.source must be a non-empty string")
            _check(p, isinstance(revision.get("commit"), str), f"{rat}.commit must be a string")
            for optional in ("tag", "error"):
                _check(
                    p,
                    revision.get(optional) is None or isinstance(revision[optional], str),
                    f"{rat}.{optional} must be a string",
                )
            changed = revision.get("tagChanged")
            if changed is not None:
                _check(
                    p,
                    _obj(changed) and _str(changed.get("previous")) and _str(changed.get("current")),
                    f"{rat}.tagChanged needs previous and current",
                )
    return p
