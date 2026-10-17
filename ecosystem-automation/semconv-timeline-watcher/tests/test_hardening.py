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

"""Failure visibility, tag reconciliation, malformed files, moves and cross-source keys."""

import json

import pytest
from semconv_timeline_watcher import main as cli
from semconv_timeline_watcher import review
from semconv_timeline_watcher.state import Store
from semconv_timeline_watcher.validation import InvalidFileError, record_problems, state_problems
from watcher_common.testing import run_git

from .conftest import CORE, GENAI, RELEASES, FakeClient, commit, release, run_core, run_genai, write


def parse(*argv):
    return cli.build_parser().parse_args(list(argv))


@pytest.fixture
def env(tmp_path, accepted_file, accepted, core, genai, monkeypatch):
    monkeypatch.setenv("GITHUB_REPOSITORY", "o/r")
    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "run")
    return {"args": args, "accepted": accepted, "core": core, "genai": genai, "tmp": tmp_path, "file": accepted_file}


def go(env, client, sources=(CORE, GENAI)):
    repos = {CORE: env["core"]["git"], GENAI: env["genai"]["git"]}
    return cli.run_command(env["args"], list(sources), env["accepted"], client=client, repos=repos, head_ref="HEAD")


def reviews(env, issues):
    args = parse("--registry-dir", str(env["tmp"] / "reg"), "--timeline", str(env["file"]), "review")
    return cli.review_command(args, env["accepted"], client=issues)


def check(env):
    args = parse("--registry-dir", str(env["tmp"] / "reg"), "--timeline", str(env["file"]), "check")
    return cli.check_command(args, env["accepted"])


# --- 1. failed revisions are visible and actionable -------------------------------------------------------


def test_a_failed_revision_gets_an_issue_and_check_fails_until_it_succeeds(env, capsys):
    client = FakeClient([*RELEASES, release("v1.5.0", "2026-04-01T00:00:00Z")])  # published; tag not fetched
    assert go(env, client, [CORE]) == 0  # the other revisions are still saved
    issues = FakeClient()
    assert reviews(env, issues) == 1  # the issue is raised, but the run is not clean
    failed = next(i for i in issues.issues if review.marker(f"{CORE}@v1.5.0") in i["body"])
    assert (
        "Extraction failed" in failed["body"]
        and "not covered" in failed["body"]
        and "refs/tags/v1.5.0" in failed["body"]
    )
    assert len(issues.issues) == 3  # two pending reviews plus the failure
    assert check(env) == 1 and "v1.5.0: failed" in capsys.readouterr().err

    run_git(env["core"]["path"], "tag", "v1.5.0", env["core"]["shas"]["v1.1.0"])  # the tag finally arrives
    assert go(env, client, [CORE]) == 0
    assert reviews(env, issues) == 0 and len(issues.issues) == 3  # the same issue, now a normal review
    assert "Extraction failed" not in failed["body"] and "## Review `semantic-conventions@v1.5.0`" in failed["body"]


def test_an_unusable_candidate_file_is_never_overwritten_and_fails_only_its_revision(env, capsys):
    client = FakeClient(RELEASES)
    go(env, client)
    path = env["tmp"] / "reg" / CORE / "candidates" / "v1.1.0.json"
    path.write_text("{ not json", encoding="utf-8")
    assert go(env, client) == 0
    assert path.read_text() == "{ not json"  # a maintainer's file is not regenerated over
    state = Store(env["tmp"] / "reg" / CORE).load_state()["sources"][CORE]
    assert state["revisions"][f"{CORE}@v1.1.0"]["status"] == "failed"
    assert state["revisions"][f"{CORE}@v1.0.1"]["status"] == "pending"  # the neighbour is unaffected
    assert Store(env["tmp"] / "reg" / GENAI).load_state()["sources"][GENAI]["revisions"]
    issues = FakeClient()
    assert reviews(env, issues) == 1
    assert any("Extraction failed" in i["body"] and "not readable JSON" in i["body"] for i in issues.issues)
    assert check(env) == 1 and "not readable JSON" in capsys.readouterr().err


def test_a_malformed_state_file_fails_only_its_source(env, capsys):
    go(env, FakeClient(RELEASES))
    (env["tmp"] / "reg" / CORE / "state.json").write_text('{"schemaVersion": 1, "sources": []}')
    assert go(env, FakeClient(RELEASES)) == 1
    assert "sources must be an object" in capsys.readouterr().err
    genai_state = Store(env["tmp"] / "reg" / GENAI).load_state()
    assert genai_state["sources"][GENAI]["revisions"]  # processed despite the other source's bad file
    issues = FakeClient()
    assert reviews(env, issues) == 1  # reported, yet the healthy source's review was still raised
    assert any(GENAI in i["title"] for i in issues.issues)
    assert check(env) == 1


@pytest.mark.parametrize(
    ("mutate", "expected"),
    [
        (lambda r: r.pop("commit"), "commit must be a 40-character SHA"),
        (lambda r: r.update(date="soon"), "date must be YYYY-MM-DD"),
        (lambda r: r.update(candidates={}), "candidates must be an array"),
        (lambda r: r["candidates"][0].update(disposition="excluded"), "disposition must be an object or null"),
        (lambda r: r["candidates"][0].update(scope={"changed": "1"}), "scope needs integer changed and total"),
        (lambda r: r["candidates"].append(dict(r["candidates"][0])), "is duplicated"),
        (lambda r: r.update(gaps=[{"kind": "info"}]), "gaps[0] needs kind and message"),
        (lambda r: r.update(noMilestone="no"), "noMilestone must be an object or null"),
    ],
)
def test_malformed_candidate_records_are_reported_not_raised(tmp_path, accepted, core, mutate, expected):
    store = Store(tmp_path / "reg")
    run_core(store, accepted, core)
    good = store.read_record(CORE, f"{CORE}@v1.1.0")
    assert record_problems(good) == []
    mutate(good)
    problems = record_problems(good)
    assert any(expected in p for p in problems), problems


def test_reading_a_malformed_record_or_state_raises_a_descriptive_error(tmp_path):
    store = Store(tmp_path)
    store.record_path(CORE, f"{CORE}@v1").parent.mkdir(parents=True)
    store.record_path(CORE, f"{CORE}@v1").write_text("[]")
    with pytest.raises(InvalidFileError, match="record must be a JSON object"):
        store.read_record(CORE, f"{CORE}@v1")
    assert state_problems(None) and state_problems({"schemaVersion": 1, "sources": {"a": {"cursor": 3}}})
    assert state_problems({"schemaVersion": 2, "sources": {}}) == ["unsupported schemaVersion 2"]


# --- 3. changed tags, including on completed revisions -----------------------------------------------------


def test_a_moved_tag_on_a_completed_revision_is_flagged_raised_and_reconcilable(env, capsys):
    client = FakeClient(RELEASES)
    go(env, client, [CORE])
    store = Store(env["tmp"] / "reg" / CORE)
    key = f"{CORE}@v1.1.0"
    record = store.read_record(CORE, key)
    for candidate in record["candidates"]:
        candidate["disposition"] = {"status": "excluded", "reason": "scoped"}
    store.write_record(record)
    assert store.read_record(CORE, key)["candidates"]
    write(env["core"]["path"], "model/extra/registry.yaml", "groups: []\n")
    moved = commit(env["core"]["path"], "later", "2026-02-10T00:00:00+00:00", env["core"]["monkeypatch"])
    run_git(env["core"]["path"], "tag", "-f", "v1.1.0", moved)

    assert go(env, client, [CORE]) == 0
    state = store.load_state()["sources"][CORE]
    assert state["revisions"][key]["status"] == "complete"  # the review itself had finished
    assert state["revisions"][key]["tagChanged"]["current"] == moved
    issues = FakeClient()
    reviews(env, issues)
    flagged = next(i for i in issues.issues if review.marker(key) in i["body"])
    assert "Tag changed upstream" in flagged["body"] and "had been completed against the old commit" in flagged["body"]
    assert check(env) == 1 and "tag moved" in capsys.readouterr().err
    assert store.read_record(CORE, key)["commit"] == env["core"]["shas"]["v1.1.0"]  # nothing rewritten

    replay = parse("--registry-dir", str(env["tmp"] / "reg"), "--timeline", str(env["file"]), "run")
    replay.tag, replay.force = "v1.1.0", True
    env["args"] = replay
    assert go(env, client, [CORE]) == 0
    fresh = store.read_record(CORE, key)
    assert fresh["commit"] == moved and "tagChanged" not in store.load_state()["sources"][CORE]["revisions"][key]
    assert all(c["disposition"] for c in fresh["candidates"])  # unchanged evidence keeps its disposition
    assert check(env) == 0


def test_an_accepted_release_whose_tag_moved_gets_its_own_issue(env):
    run_git(env["core"]["path"], "tag", "-f", "v1.0.0", env["core"]["shas"]["v1.0.1"])
    go(env, FakeClient(RELEASES), [CORE])
    issues = FakeClient()
    reviews(env, issues)
    moved = [i for i in issues.issues if "#tag-moved" in i["body"]]
    assert len(moved) == 1 and "Accepted history was **not** modified" in moved[0]["body"]
    assert check(env) == 1


# --- 4. moves: destination status and uncovered interval ---------------------------------------------------


def test_a_move_review_shows_destination_monitoring_and_the_uncovered_interval(tmp_path, accepted, genai, core):
    genai_store, core_store = Store(tmp_path / "g"), Store(tmp_path / "c")
    genai_state, _ = run_genai(genai_store, accepted, genai)
    coverage = {GENAI: review.source_coverage(accepted, GENAI, genai_state)}
    assert coverage[GENAI]["head"] == genai["shas"]["relevant"] and coverage[GENAI]["pending"] == 1
    (key,) = genai_state["revisions"]
    body = review.render_body(
        genai_store.read_record(GENAI, key), "pending", accepted, genai_state["revisions"][key], "f.json", coverage
    )
    assert "### Move: GenAI (`genai-moved`)" in body
    assert "Destination monitoring: `commit`-mode source; accepted coverage through" in body
    assert f"Uncovered interval: `{genai['shas']['start'][:12]}..{genai['shas']['relevant'][:12]}`" in body
    assert "Definitions imported before the move are not candidates" in body

    # Core side of the same lane: the old definitions are not proposed and the destination status is shown.
    core_state, _ = run_core(core_store, accepted, core)
    record = core_store.read_record(CORE, f"{CORE}@v1.1.0")
    record["candidates"][0]["lane"] = "genai"
    unmonitored = review.render_body(
        record, "pending", accepted, core_state["revisions"][f"{CORE}@v1.1.0"], "f.json", {}
    )
    assert "nothing is extracted for it yet" in unmonitored
    assert "Changes to this lane's old definitions are not proposed here" in unmonitored


# --- 6. issue content safety --------------------------------------------------------------------------------


def test_untrusted_text_cannot_ping_users_and_bodies_stay_under_the_limit(tmp_path, accepted, core):
    store = Store(tmp_path / "reg")
    state, _ = run_core(store, accepted, core)
    key = f"{CORE}@v1.1.0"
    record = store.read_record(CORE, key)
    record["gaps"].append({"kind": "info", "message": "thanks @octocat and @org/team <!-- x -->"})
    record["candidates"][0]["reasons"].append("cc @maintainer")
    body = review.render_body(record, "pending", accepted, state["revisions"][key], "f.json")
    assert "@octocat" not in body and "@org/team" not in body and "@maintainer" not in body and "<!-- x" not in body
    record["candidates"][0]["subjects"] = [f"s{'x' * 200}{i}" for i in range(2000)] * 1
    record["gaps"] += [{"kind": "info", "message": "m" * 2000}] * 50
    assert len(review.render_body(record, "pending", accepted, state["revisions"][key], "f.json")) < 61000
    failure = review.render_failure_body(key, CORE, {"commit": "a" * 40}, accepted, "boom @octocat\n" + "x" * 5000)
    assert "@octocat" not in failure and len(failure) < 61000


# --- cross-source collisions -----------------------------------------------------------------------------


def test_the_same_tag_in_two_sources_never_collides(env):
    args = env["args"]
    assert cli.store_for(args, CORE).dir != cli.store_for(args, GENAI).dir
    assert review.record_file(CORE, f"{CORE}@v1.0.0") != review.record_file(GENAI, f"{GENAI}@v1.0.0")
    assert review.marker(f"{CORE}@v1.0.0") != review.marker(f"{GENAI}@v1.0.0")
    items = [
        {
            "kind": "revision",
            "key": f"{source}@v1.0.0",
            "source": source,
            "record": None,
            "status": "failed",
            "state": {"error": "x", "commit": "a" * 40},
            "coverage": {},
        }
        for source in (CORE, GENAI)
    ]
    issues = FakeClient()
    actions = review.upsert_reviews(issues, "o/r", items, env["accepted"])
    assert [a for _, a in actions] == ["created", "created"] and len(issues.issues) == 2
    assert {i["title"] for i in issues.issues} == {
        f"[semconv timeline] Review {CORE}@v1.0.0",
        f"[semconv timeline] Review {GENAI}@v1.0.0",
    }


# --- candidate files must be validated against everything the renderer reads ----------------------------


def _valid_record(store_dir, accepted, core, key=f"{CORE}@v1.1.0"):
    store = Store(store_dir)
    run_core(store, accepted, core)
    return store, store.read_record(CORE, key)


MALFORMED = {
    "evidence entry without label": (
        lambda r: r["candidates"][0]["evidence"].__setitem__(0, {"url": "https://x"}),
        "evidence[0] needs non-empty label and url",
    ),
    "evidence entry without url": (
        lambda r: r["candidates"][0]["evidence"].__setitem__(0, {"label": "l"}),
        "evidence[0] needs non-empty label and url",
    ),
    "candidate without proposedType": (
        lambda r: r["candidates"][0].pop("proposedType"),
        "proposedType must be a non-empty string",
    ),
    "resetReviews without fromCommit": (
        lambda r: r.update(resetReviews={"candidates": [], "noMilestone": None}),
        "resetReviews.fromCommit must be a non-empty string",
    ),
    "resetReviews with a bad noMilestone": (
        lambda r: r.update(resetReviews={"fromCommit": "a" * 40, "candidates": [], "noMilestone": "x"}),
        "resetReviews.noMilestone must be an object or null",
    ),
    "partial method.structure": (
        lambda r: r["method"].update(structure={"groupsAdded": 1}),
        "method.structure needs integer groupsAdded, groupsRemoved, subjectsAddedToExistingNamespaces",
    ),
    "range without relevantCommits": (
        lambda r: r.update(kind="range"),
        "relevantCommits must be an array for a range record",
    ),
    "range commit without subject": (
        lambda r: r.update(kind="range", relevantCommits=[{"commit": "abc"}]),
        "relevantCommits[0] needs commit and subject strings",
    ),
    "non-string warning": (
        lambda r: r["candidates"][0]["warnings"].append(3),
        "warnings must be an array of strings",
    ),
    "non-string compareUrl": (lambda r: r.update(compareUrl=5), "compareUrl must be a string when present"),
}


@pytest.mark.parametrize("name", sorted(MALFORMED))
def test_every_field_the_renderer_reads_is_validated_with_its_path(tmp_path, accepted, core, name):
    mutate, expected = MALFORMED[name]
    _, record = _valid_record(tmp_path / "reg", accepted, core)
    assert record_problems(record) == []
    mutate(record)
    problems = record_problems(record)
    assert any(expected in p for p in problems), problems
    # The defect names the candidate it is in, not just an index.
    if "candidates[0]" in "".join(problems):
        assert any(record["candidates"][0]["id"] in p for p in problems)


@pytest.mark.parametrize("name", sorted(MALFORMED))
def test_a_malformed_record_becomes_an_actionable_issue_and_never_a_crash(tmp_path, accepted, core, name):
    mutate, expected = MALFORMED[name]
    store, record = _valid_record(tmp_path / "reg", accepted, core)
    key = f"{CORE}@v1.1.0"
    mutate(record)
    item = {
        "kind": "revision",
        "key": key,
        "source": CORE,
        "record": record,
        "status": "pending",
        "state": {"kind": "release", "source": CORE, "commit": record["commit"]},
        "coverage": {},
    }
    issues = FakeClient()
    ((_, action),) = review.upsert_reviews(issues, "o/r", [item], accepted)
    assert action == "created"
    body = issues.issues[0]["body"]
    assert "Extraction failed" in body and expected in body  # says exactly what to fix
    assert "[ ] `" not in body  # no half-rendered candidate checklist is presented as reviewable


def test_a_record_for_another_revision_or_source_is_rejected_not_published(tmp_path, accepted, core):
    _, record = _valid_record(tmp_path / "reg", accepted, core)
    item = {
        "kind": "revision",
        "key": f"{CORE}@v9.9.9",
        "source": CORE,
        "record": record,
        "status": "pending",
        "state": {"commit": record["commit"]},
        "coverage": {},
    }
    issues = FakeClient()
    review.upsert_reviews(issues, "o/r", [item], accepted)
    shown = issues.issues[0]["body"].replace("\u200b", "")  # mentions are defused with a zero-width space
    assert "record is for semantic-conventions@v1.1.0, not semantic-conventions@v9.9.9" in shown
    record["source"] = "elsewhere"
    item["key"] = record["reviewKey"]
    other = FakeClient()
    review.upsert_reviews(other, "o/r", [item], accepted)
    assert "is for" in other.issues[0]["body"] or "unknown source" in other.issues[0]["body"]


def test_one_malformed_record_does_not_block_the_valid_one_after_it(env, capsys):
    go(env, FakeClient(RELEASES), [CORE])
    store = Store(env["tmp"] / "reg" / CORE)
    first, second = f"{CORE}@v1.0.1", f"{CORE}@v1.1.0"  # review order is by key: the bad one comes first
    bad = store.read_record(CORE, first)
    bad["method"]["structure"] = {"groupsAdded": 1}
    store.record_path(CORE, first).write_text(json.dumps(bad))
    issues = FakeClient()
    assert reviews(env, issues) == 1  # non-zero: the workflow must notify
    by_marker = {m: i for m in (first, second) for i in issues.issues if review.marker(m) in i["body"]}
    assert (
        "method.structure needs integer" in by_marker[first]["body"] and "Extraction failed" in by_marker[first]["body"]
    )
    assert "## Review `semantic-conventions@v1.1.0`" in by_marker[second]["body"]  # the valid one was processed
    assert "method.structure" not in by_marker[second]["body"]
    state = Store(env["tmp"] / "reg" / CORE).load_state()["sources"][CORE]
    assert state["revisions"][first]["status"] in ("pending", "failed")  # never completed or accepted


def test_a_publish_error_on_one_item_does_not_stop_the_rest(env, capsys):
    go(env, FakeClient(RELEASES), [CORE])

    class Flaky(FakeClient):
        def create_issue(self, repo, title, body, labels):
            if "v1.0.1" in title:
                raise RuntimeError("GitHub is unhappy")
            return super().create_issue(repo, title, body, labels)

    issues = Flaky()
    assert reviews(env, issues) == 1
    assert [i["title"] for i in issues.issues] == [f"[semconv timeline] Review {CORE}@v1.1.0"]
    assert "failed: RuntimeError: GitHub is unhappy" in capsys.readouterr().err


def test_a_renderer_bug_is_isolated_per_item(env, monkeypatch, capsys):
    go(env, FakeClient(RELEASES), [CORE])
    real = review.render_body

    def explode_for_one(record, *args, **kwargs):
        if record["reviewKey"].endswith("v1.0.1"):
            raise KeyError("something unexpected")
        return real(record, *args, **kwargs)

    monkeypatch.setattr(review, "render_body", explode_for_one)
    issues = FakeClient()
    assert reviews(env, issues) == 1
    assert len(issues.issues) == 1 and "v1.1.0" in issues.issues[0]["title"]
    assert "failed: KeyError" in capsys.readouterr().err
