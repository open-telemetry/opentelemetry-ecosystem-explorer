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

"""State files: validated atomic writes, dispositions, completion and the processing cursor."""

import copy
import json
import os

import pytest
from semconv_timeline_watcher.state import (
    COMPLETE,
    FAILED,
    PARTIAL,
    PENDING,
    Store,
    check_record,
    cursor_of,
    merge_dispositions,
    record_status,
    stem,
)
from semconv_timeline_watcher.validation import InvalidFileError


def make_record(candidates=(), *, incomplete=False, no_milestone=None, commit="a" * 40):
    return {
        "reviewKey": "semantic-conventions@v1.1.0",
        "source": "semantic-conventions",
        "commit": commit,
        "candidates": [
            dict(id=c, disposition=None, transition="t", scope={"changed": 1, "total": 2}) for c in candidates
        ],
        "incomplete": incomplete,
        "noMilestone": no_milestone,
    }


def empty_source():
    return {"cursor": None, "order": [], "reconcile": [], "revisions": {}}


def test_files_are_sorted_stable_and_timestamp_free(tmp_path):
    store = Store(tmp_path)
    store.save_state({"schemaVersion": 1, "sources": {"b": empty_source(), "a": empty_source()}})
    first = store.state_path.read_text()
    store.save_state({"sources": {"a": empty_source(), "b": empty_source()}, "schemaVersion": 1})
    assert store.state_path.read_text() == first
    assert list(json.loads(first)["sources"]) == ["a", "b"]


def test_a_failed_replace_keeps_the_previous_valid_state(tmp_path, monkeypatch):
    store = Store(tmp_path)
    store.save_state({"schemaVersion": 1, "sources": {"a": empty_source()}})
    before = store.state_path.read_text()

    def boom(*_):
        raise OSError("disk full")

    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        store.save_state({"schemaVersion": 1, "sources": {"changed": empty_source()}})
    monkeypatch.undo()
    assert store.state_path.read_text() == before
    assert store.recover() == 1  # the staged file is cleaned up on the next run
    assert not list(tmp_path.rglob("*.tmp"))


def test_unsupported_state_versions_are_refused(tmp_path):
    (tmp_path / "state.json").write_text('{"schemaVersion": 99, "sources": {}}')
    with pytest.raises(ValueError, match="schemaVersion"):
        Store(tmp_path).load_state()


def test_file_names_are_path_safe():
    assert stem("semantic-conventions@v1.44.0") == "v1.44.0"
    assert stem("semantic-conventions-genai@ebe3d1fb9fdd..") == "ebe3d1fb9fdd"
    assert stem("semantic-conventions-genai@ebe3d1fb9fdd..6fd0d763a092") == "ebe3d1fb9fdd-to-6fd0d763a092"


def test_a_revision_is_complete_only_with_every_disposition_or_a_no_milestone_reason(accepted):
    assert record_status(None, accepted) == FAILED
    assert record_status(make_record(["a"]), accepted) == PENDING
    assert record_status(make_record(["a"], incomplete=True), accepted) == PARTIAL
    assert record_status(make_record(), accepted) == PENDING  # zero candidates is not yet a reviewed result
    assert record_status(make_record(no_milestone={"reason": "only reorganisation"}), accepted) == COMPLETE
    record = make_record(["a", "b"])
    record["candidates"][0]["disposition"] = {"status": "excluded", "reason": "scoped"}
    assert record_status(record, accepted) == PENDING
    record["candidates"][1]["disposition"] = {"status": "accepted", "eventId": "k8s-existing"}
    assert record_status(record, accepted) == COMPLETE


def test_invalid_dispositions_do_not_complete_a_revision(accepted):
    record = make_record(["a"])
    record["candidates"][0]["disposition"] = {"status": "accepted", "eventId": "not-in-timeline"}
    assert "not in timeline.json" in check_record(record, accepted)[0]
    assert record_status(record, accepted) == PENDING
    record["candidates"][0]["disposition"] = {"status": "excluded", "reason": "  "}
    assert "needs a reason" in check_record(record, accepted)[0]
    assert check_record(make_record(no_milestone={"reason": ""}), accepted)
    both = make_record(["a"], no_milestone={"reason": "x"})
    assert "noMilestone is set but candidates exist" in check_record(both, accepted)[0]


def test_dispositions_survive_regeneration_by_candidate_id():
    old = make_record(["a", "b"])
    old["candidates"][0]["disposition"] = {"status": "excluded", "reason": "kept"}
    merged = merge_dispositions(old, make_record(["a", "c"]))
    assert [c["disposition"] for c in merged["candidates"]] == [{"status": "excluded", "reason": "kept"}, None]
    assert merge_dispositions(make_record(no_milestone={"reason": "r"}), make_record())["noMilestone"] == {
        "reason": "r"
    }
    assert merge_dispositions(make_record(no_milestone={"reason": "r"}), make_record(["x"]))["noMilestone"] is None


def test_the_cursor_never_moves_past_a_revision_that_is_not_complete():
    revisions = {"a": {"status": COMPLETE}, "b": {"status": PENDING}, "c": {"status": COMPLETE}}
    assert cursor_of(["a", "b", "c"], revisions) == "a"
    assert cursor_of(["b", "a", "c"], revisions) is None
    assert cursor_of([], revisions) is None


def _candidate(cid, subjects, disposition=None):
    return {
        "id": cid,
        "transition": "t",
        "scope": {"changed": len(subjects), "total": 9},
        "fromStates": {},
        "subjects": subjects,
        "disposition": disposition,
    }


def test_replaying_the_same_revision_keeps_every_disposition():
    old = make_record(no_milestone={"reason": "r"})
    assert merge_dispositions(old, make_record())["noMilestone"] == {"reason": "r"}


def test_a_changed_revision_never_inherits_no_milestone_and_resets_changed_evidence():
    kept = {"status": "excluded", "reason": "same evidence"}
    old = {
        **make_record(commit="a" * 40),
        "candidates": [
            _candidate("same", ["x"], kept),
            _candidate("grew", ["x"], {"status": "excluded", "reason": "was small"}),
        ],
    }
    new = {**make_record(commit="b" * 40), "candidates": [_candidate("same", ["x"]), _candidate("grew", ["x", "y"])]}
    merged = merge_dispositions(old, new)
    assert merged["candidates"][0]["disposition"] == kept
    assert merged["candidates"][1]["disposition"] is None
    assert merged["resetReviews"] == {"fromCommit": "a" * 40, "candidates": ["grew"], "noMilestone": None}
    reviewed = merge_dispositions(make_record(no_milestone={"reason": "all of A..B"}), make_record(commit="b" * 40))
    assert reviewed["noMilestone"] is None and reviewed["resetReviews"]["noMilestone"] == {"reason": "all of A..B"}


def valid_record(**changes):
    """A complete candidate record as the extractor writes it."""
    record = {
        "schemaVersion": 1,
        "reviewKey": "semantic-conventions@v1.1.0",
        "source": "semantic-conventions",
        "kind": "release",
        "tag": "v1.1.0",
        "commit": "a" * 40,
        "date": "2026-02-02",
        "dateBasis": "release-published-at",
        "baselineTag": "v1.0.0",
        "candidates": [
            {
                "id": "c1",
                "kind": "stability",
                "proposedType": "stability",
                "fromStates": {},
                "disposition": None,
                "transition": "http: experimental to stable",
                "scope": {"changed": 1, "total": 2},
                "evidence": [{"label": "model", "url": "https://example.test/m"}],
                "reasons": [],
                "warnings": [],
                "subjects": ["http"],
            }
        ],
        "incomplete": False,
        "noMilestone": None,
        "method": {},
        "gaps": [],
    }
    record.update(changes)
    return record


def test_valid_records_and_states_are_written_and_read_back(tmp_path):
    store = Store(tmp_path)
    record = valid_record()
    store.write_record(record)
    assert store.read_record(record["source"], record["reviewKey"]) == record
    store.save_state({"schemaVersion": 1, "sources": {}})  # a legitimately empty state
    assert store.load_state() == {"schemaVersion": 1, "sources": {}}
    store.write_record(valid_record(candidates=[]))  # a revision with nothing to propose is valid
    assert store.read_record("semantic-conventions", "semantic-conventions@v1.1.0")["candidates"] == []


def test_an_invalid_record_never_replaces_the_last_valid_file(tmp_path):
    store = Store(tmp_path)
    store.write_record(valid_record())
    path = store.record_path("semantic-conventions", "semantic-conventions@v1.1.0")
    before = path.read_bytes()
    broken = valid_record()
    del broken["candidates"][0]["evidence"][0]["url"]
    with pytest.raises(
        InvalidFileError, match=r"candidates\[0\] \(c1\)\.evidence\[0\] needs non-empty label and url"
    ) as e:
        store.write_record(broken)
    assert "v1.1.0.json" in str(e.value)  # names the record that was refused
    assert path.read_bytes() == before
    assert not list(tmp_path.rglob("*.tmp"))  # nothing was staged either


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda r: r.pop("date"), "date must be a non-empty string"),
        (lambda r: r.update(schemaVersion=2), "schemaVersion must be 1"),
        (lambda r: r.update(kind="nightly"), "kind must be one of"),
        (lambda r: r["candidates"][0].update(proposedType=None), "proposedType"),
        (lambda r: r["candidates"][0].update(warnings="careful"), "warnings"),
        (lambda r: r.update(candidates={"c1": {}}), "candidates"),
    ],
)
def test_malformed_and_missing_record_fields_are_rejected_with_the_field_named(tmp_path, mutate, message):
    store = Store(tmp_path)
    record = copy.deepcopy(valid_record())
    mutate(record)
    with pytest.raises(InvalidFileError, match=message):
        store.write_record(record)
    assert not (tmp_path / "candidates").exists()  # nothing was created for a refused record


def test_a_record_that_is_not_an_object_or_has_no_key_is_refused_without_crashing(tmp_path):
    for bad in ([], None, {"source": "semantic-conventions"}):
        with pytest.raises(InvalidFileError, match="must be"):
            Store(tmp_path).write_record(bad)


def test_invalid_state_never_replaces_the_last_valid_file(tmp_path):
    store = Store(tmp_path)
    store.save_state({"schemaVersion": 1, "sources": {"a": empty_source()}})
    before = store.state_path.read_bytes()
    for bad in (
        {"schemaVersion": 1, "sources": {"a": {}}},
        {"schemaVersion": 1, "sources": {"a": {**empty_source(), "cursor": 5}}},
        {"schemaVersion": 1, "sources": {"a": {**empty_source(), "revisions": {"k": {"kind": "release"}}}}},
        {"schemaVersion": 7, "sources": {}},
        [],
    ):
        with pytest.raises(InvalidFileError):
            store.save_state(bad)
        assert store.state_path.read_bytes() == before
    assert not list(tmp_path.rglob("*.tmp"))


def test_a_state_error_names_the_file_and_the_nested_field(tmp_path):
    state = {"schemaVersion": 1, "sources": {"a": {**empty_source(), "revisions": {"k": {"kind": "release"}}}}}
    with pytest.raises(InvalidFileError) as e:
        Store(tmp_path).save_state(state)
    assert "state.json" in str(e.value) and "sources.a.revisions[k].source must be a non-empty string" in str(e.value)
