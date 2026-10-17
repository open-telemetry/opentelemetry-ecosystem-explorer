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

"""Automation-owned processing state and candidate records.

Everything here lives under ``ecosystem-registry/semantic-conventions/`` and is separate from the
accepted history in ``timeline.json``. Every record is validated with the same rules the reader and
the review renderer use *before* anything is staged, then written to a temporary file, read back, and
moved into place with ``os.replace``, so invalid data or an interrupted run leaves the previous valid
file. Output is sorted and carries no timestamps, so unchanged inputs rewrite identical bytes.

Two different marks exist and must not be confused:

* ``reviewedThrough`` (in ``timeline.json``) is the accepted-history coverage mark. Only a merged
  change by a maintainer moves it. This module never writes it.
* ``cursor`` (here) is the processing mark: the last revision of the contiguous run of *completed*
  revisions. It never moves past a pending, partial or failed revision.
"""

import json
import logging
import os
from pathlib import Path

from .accepted import AcceptedHistory
from .validation import InvalidFileError, record_problems, state_problems

logger = logging.getLogger(__name__)

STATE_VERSION = 1
REGISTRY_DIR = Path("ecosystem-registry/semantic-conventions")
COMPLETE, PENDING, PARTIAL, FAILED = "complete", "pending", "partial", "failed"


def _dump(data: dict) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def empty_state() -> dict:
    return {"schemaVersion": STATE_VERSION, "sources": {}}


def stem(review_key: str) -> str:
    """File name for a review key: the part after ``@``, with range dots made path-safe."""
    rest = review_key.split("@", 1)[1]
    return rest[:-2] if rest.endswith("..") else rest.replace("..", "-to-")


class Store:
    def __init__(self, directory: Path | str = REGISTRY_DIR):
        self.dir = Path(directory)

    @property
    def state_path(self) -> Path:
        return self.dir / "state.json"

    def record_path(self, source: str, review_key: str) -> Path:
        """Each source has its own store directory, so the file name only needs the revision."""
        return self.dir / "candidates" / f"{stem(review_key)}.json"

    def _atomic_write(self, path: Path, data: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(_dump(data), encoding="utf-8")
        if json.loads(tmp.read_text(encoding="utf-8")) != json.loads(json.dumps(data)):
            tmp.unlink()
            raise OSError(f"staged write of {path} did not read back identically")
        os.replace(tmp, path)

    def recover(self) -> int:
        """Remove staged files left by an interrupted run. The real files are untouched."""
        stale = list(self.dir.rglob("*.tmp")) if self.dir.exists() else []
        for path in stale:
            path.unlink()
        return len(stale)

    def load_state(self) -> dict:
        if not self.state_path.exists():
            return empty_state()
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            raise InvalidFileError(self.state_path, [f"not readable JSON: {e}"]) from e
        problems = state_problems(state)
        if problems:
            raise InvalidFileError(self.state_path, problems)
        return state

    def save_state(self, state: dict) -> None:
        """Validate, then replace. Invalid state raises InvalidFileError and the last valid file stays."""
        problems = state_problems(state)
        if problems:
            raise InvalidFileError(self.state_path, problems)
        self._atomic_write(self.state_path, state)

    def read_record(self, source: str, review_key: str) -> dict | None:
        """The stored record, None if absent. A malformed file raises InvalidFileError; it is never overwritten."""
        path = self.record_path(source, review_key)
        if not path.exists():
            return None
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            raise InvalidFileError(path, [f"not readable JSON: {e}"]) from e
        problems = record_problems(record)
        if problems:
            raise InvalidFileError(path, problems)
        return record

    def write_record(self, record: dict) -> None:
        """Validate, then replace. Invalid data raises InvalidFileError and the last valid file stays."""
        problems = record_problems(record)
        if problems:
            key = record.get("reviewKey") if isinstance(record, dict) else None
            name = f"{stem(key)}.json" if isinstance(key, str) and "@" in key else "<invalid record>"
            raise InvalidFileError(self.dir / "candidates" / name, problems)
        self._atomic_write(self.record_path(record["source"], record["reviewKey"]), record)

    def delete_record(self, source: str, review_key: str) -> None:
        self.record_path(source, review_key).unlink(missing_ok=True)


def _digest(candidate: dict) -> str:
    keys = ("transition", "scope", "fromStates", "subjects")
    return json.dumps({k: candidate.get(k) for k in keys}, sort_keys=True)


def merge_dispositions(old: dict | None, new: dict) -> dict:
    """Carry maintainer dispositions over to a regenerated record.

    Replaying the same revision keeps every disposition. If the revision changed (a range grew, or a
    tag moved), a disposition survives only for a candidate whose evidence is identical, and a
    ``noMilestone`` never survives: the new evidence has not been reviewed. What was reset is recorded.
    """
    if not old:
        return new
    same_revision = old.get("commit") == new["commit"]
    previous = {c["id"]: c for c in old["candidates"]}
    reset = []
    for candidate in new["candidates"]:
        before = previous.get(candidate["id"])
        if before and before.get("disposition"):
            if same_revision or _digest(before) == _digest(candidate):
                candidate["disposition"] = before["disposition"]
            else:
                reset.append(candidate["id"])
    if same_revision and old.get("noMilestone") and not new["candidates"]:
        new["noMilestone"] = old["noMilestone"]
    if not same_revision and (old.get("noMilestone") or reset):
        new["resetReviews"] = {
            "fromCommit": old["commit"],
            "candidates": sorted(reset),
            "noMilestone": old.get("noMilestone"),
        }
    return new


def check_record(record: dict, accepted: AcceptedHistory) -> list[str]:
    """Problems with the dispositions in a record; an empty list means they are well formed."""
    problems = []
    for candidate in record["candidates"]:
        disposition = candidate.get("disposition")
        if disposition is None:
            continue
        status = disposition.get("status")
        if status == "accepted":
            if disposition.get("eventId") not in accepted.events:
                problems.append(
                    f"{candidate['id']}: accepted event {disposition.get('eventId')!r} is not in timeline.json"
                )
        elif status == "excluded":
            if not str(disposition.get("reason", "")).strip():
                problems.append(f"{candidate['id']}: an excluded candidate needs a reason")
        else:
            problems.append(f"{candidate['id']}: unknown disposition status {status!r}")
    no_milestone = record.get("noMilestone")
    if no_milestone is not None and not str(no_milestone.get("reason", "")).strip():
        problems.append(f"{record['reviewKey']}: noMilestone needs a reason")
    if no_milestone is not None and record["candidates"]:
        problems.append(f"{record['reviewKey']}: noMilestone is set but candidates exist; dispose of each instead")
    return problems


def record_status(record: dict | None, accepted: AcceptedHistory) -> str:
    """Complete only when every candidate is accepted or excluded, or a no-milestone reason is recorded."""
    if record is None:
        return FAILED
    if check_record(record, accepted):
        return PENDING
    candidates = record["candidates"]
    disposed = all(c.get("disposition") for c in candidates)
    reviewed = disposed if candidates else record.get("noMilestone") is not None
    if reviewed:
        return COMPLETE
    return PARTIAL if record.get("incomplete") else PENDING


def cursor_of(order: list[str], revisions: dict[str, dict]) -> str | None:
    """The last key of the contiguous completed prefix of *order*."""
    cursor = None
    for key in order:
        if revisions.get(key, {}).get("status") != COMPLETE:
            break
        cursor = key
    return cursor
