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

"""Review issue content, stable keying and idempotent upserts."""

from semconv_timeline_watcher import pipeline, review
from semconv_timeline_watcher.state import Store

from .conftest import CORE, GENAI, FakeClient, run_core, run_genai


def _items(store, accepted, state, source, coverage=None):
    return [
        {
            "kind": "revision",
            "key": key,
            "source": source,
            "record": store.read_record(source, key),
            "status": revision["status"],
            "state": revision,
            "coverage": coverage or {},
        }
        for key, revision in state["revisions"].items()
    ]


def test_review_body_gives_a_maintainer_everything_needed_to_decide(tmp_path, accepted, core):
    store = Store(tmp_path / "reg")
    state, _ = run_core(store, accepted, core)
    key = f"{CORE}@v1.1.0"
    body = review.render_body(
        store.read_record(CORE, key), "pending", accepted, state["revisions"][key], "ecosystem-registry/x.json"
    )
    assert body.startswith(review.marker(key))
    for expected in [
        core["shas"]["v1.1.0"],
        core["shas"]["v1.0.0"],
        "release-published-at",
        "2026-02-02",
        "/compare/",
        "- [ ] `semantic-conventions@v1.1.0/stability/k8s/stable`",
        "1 of 3 subjects",
        "/issues/10",
        "Extraction gaps and ambiguities",
        "ambiguity",
        "Record a disposition",
        '"status": "accepted"',
        '"status": "excluded"',
        "noMilestone",
        "timeline.json",
        "uv run semconv-timeline-watcher check",
        "bun run test",
        "does not move it",
        "Closing this issue does not complete the review",
        "`http-new`",
    ]:
        assert expected in body, expected
    assert body == review.render_body(
        store.read_record(CORE, key), "pending", accepted, state["revisions"][key], "ecosystem-registry/x.json"
    )


def test_genai_review_lists_commits_and_the_coverage_it_does_not_advance(tmp_path, accepted, genai):
    store = Store(tmp_path / "reg")
    state, _ = run_genai(store, accepted, genai)
    (key,) = state["revisions"]
    body = review.render_body(store.read_record(GENAI, key), "pending", accepted, state["revisions"][key], "f.json")
    assert "commit-date" in body and "Add prompt versioning (#137)" in body and genai["shas"]["start"][:12] in body
    assert "No candidates were extracted" in body and "not** a verified absence" in body


def test_an_incomplete_extraction_is_never_presented_as_no_change(tmp_path, accepted, core):
    store = Store(tmp_path / "reg")
    state, _ = run_core(store, accepted, core, tag="v1.0.1")
    key = f"{CORE}@v1.0.1"
    record = store.read_record(CORE, key)
    record["gaps"].append({"kind": "incomplete", "message": "2 model file(s) could not be parsed"})
    body = review.render_body(record, "partial", accepted, state["revisions"][key], "f.json")
    assert "**partial**" in body and "could not be parsed" in body


def test_upserts_are_keyed_idempotent_and_reopen_incomplete_reviews(tmp_path, accepted, core):
    store, client = Store(tmp_path / "reg"), FakeClient()
    state, _ = run_core(store, accepted, core)
    items = _items(store, accepted, state, CORE)
    first = review.upsert_reviews(client, "o/r", items, accepted)
    assert sorted(a for _, a in first) == ["created", "created"] and len(client.issues) == 2
    again = review.upsert_reviews(client, "o/r", items, accepted)
    assert {a for _, a in again} == {"unchanged"} and len(client.issues) == 2  # no duplicates on rerun
    client.issues[0]["state"] = "closed"
    reopened = review.upsert_reviews(client, "o/r", items, accepted)
    assert client.issues[0]["state"] == "open" and "reopened" in {a for _, a in reopened}
    assert any(c[0] == "comment" and "still needs a maintainer" in c[2] for c in client.calls)
    items[0]["record"]["gaps"].append({"kind": "info", "message": "new evidence"})
    assert "updated" in {a for _, a in review.upsert_reviews(client, "o/r", items, accepted)}
    assert {i["labels"][0] for i in client.issues} == {review.LABEL}


def test_completed_revisions_get_no_issue(tmp_path, accepted, core):
    store, client = Store(tmp_path / "reg"), FakeClient()
    state, _ = run_core(store, accepted, core, tag="v1.0.1")
    record = store.read_record(CORE, f"{CORE}@v1.0.1")
    record["noMilestone"] = {"reason": "code generation only"}
    store.write_record(record)
    state = pipeline.refresh_statuses(store, accepted, state)
    assert review.upsert_reviews(client, "o/r", _items(store, accepted, state, CORE), accepted) == []
    assert client.issues == []
