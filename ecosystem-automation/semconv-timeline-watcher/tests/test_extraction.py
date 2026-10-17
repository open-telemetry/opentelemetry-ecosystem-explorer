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

"""Git access, model snapshots, changelog parsing and candidate extraction."""

import pytest
from semconv_timeline_watcher import changelog, discovery, revisions
from semconv_timeline_watcher.extract import extract_candidates
from semconv_timeline_watcher.gitrepo import GitError
from semconv_timeline_watcher.model_diff import Snapshot, take_snapshot
from watcher_common.testing import git_commit, run_git

from .conftest import write


def test_resolve_pins_tags_branches_and_rejects_bad_refs(core):
    git, shas = core["git"], core["shas"]
    assert git.tag_commit("v1.1.0") == shas["v1.1.0"]
    assert git.resolve("main") == shas["v1.1.0"]
    for bad in ["--output=x", "v1.1.0; rm", "", "nope"]:
        with pytest.raises(GitError):
            git.resolve(bad)


def test_commit_date_is_normalised_to_utc(core):
    # Committed at 23:30 on Feb 1 in UTC-5, which is Feb 2 in UTC.
    assert core["git"].commit_date(core["shas"]["v1.1.0"]) == "2026-02-02"


def test_snapshot_reads_both_registry_formats_and_ignores_refs(core):
    after = take_snapshot(core["git"], "v1.1.0")
    assert after.subjects[("attribute", "k8s.pod.name")] == "stable"
    assert after.subjects[("attribute", "http.flavor")] == "deprecated"
    assert after.subjects[("attribute", "messaging.system")] == "stable"  # from the definition/2 file
    assert ("metric", "process.cpu.time") in after.subjects
    assert "messaging.attributes.common" in after.structure and "span.messaging.kafka.send" in after.structure
    assert not [s for s in after.subjects if s[1].startswith("messaging.attributes")]


def test_unparseable_model_files_are_listed_not_skipped(core):
    write(core["path"], "model/broken.yaml", "groups: [unclosed\n")
    core["monkeypatch"].setenv("GIT_COMMITTER_DATE", "2026-03-01T00:00:00+00:00")
    run_git(core["path"], "add", "-A")
    git_commit(core["path"], "break")
    assert take_snapshot(core["git"], "HEAD").unparsed == ["model/broken.yaml"]


def test_changelog_sections_and_references():
    text = (
        "# C\n\n## v1.1.0\n\n- `k8s, container`: Promote things ([#10](https://x/10))\n  more text\n"
        "- plain entry\n\n## 1.0.0 (2023-01-01)\n\n- `a`: old\n"
    )
    entries = changelog.parse_changelog_section(text, "1.1.0")
    assert entries[0]["scope"] == ["container", "k8s"]
    assert entries[0]["references"] == [{"number": 10, "url": "https://x/10"}]
    assert entries[1]["scope"] == [] and len(entries) == 2
    assert [e["text"] for e in changelog.parse_changelog_section(text, "1.0.0")] == [
        "old"
    ]  # unprefixed heading with a date
    assert changelog.parse_changelog_section(text, "9.9.9") is None


def test_changelog_fragment():
    entry = changelog.parse_fragment("137.enhancement.md", "Add `gen_ai.x`.\n", "https://github.com/o/r")
    assert entry["references"] == [{"number": 137, "url": "https://github.com/o/r/pull/137"}]
    assert changelog.parse_fragment("README.md", "x", "https://github.com/o/r") is None


def _extract(core, accepted, tag="v1.1.0", base="v1.0.0"):
    git = core["git"]
    spec = revisions.release_spec(
        source="semantic-conventions",
        repository="https://github.com/open-telemetry/semantic-conventions",
        tag=tag,
        commit=git.tag_commit(tag),
        date="2026-02-02",
        baseline_tag=base,
        baseline_commit=git.tag_commit(base),
    )
    return revisions.build_record(spec, git, accepted, ["model", "CHANGELOG.md"])


def test_scoped_stability_transition(core, accepted):
    record = _extract(core, accepted)
    by_id = {c["id"]: c for c in record["candidates"]}
    stable = by_id["semantic-conventions@v1.1.0/stability/k8s/stable"]
    assert stable["scope"] == {"changed": 1, "total": 3} and stable["fromStates"] == {"release_candidate": 1}
    assert stable["lane"] == "k8s" and stable["requiresReview"] and stable["disposition"] is None
    assert any("Scoped change" in w for w in stable["warnings"])
    assert any(link["url"].endswith("/issues/10") for link in stable["evidence"])
    rc = by_id["semantic-conventions@v1.1.0/stability/k8s/release_candidate"]
    assert rc["fromStates"] == {"development": 1}


def test_a_previous_state_upstream_never_stated_stays_unknown(accepted):
    before = Snapshot(subjects={("attribute", "k8s.a"): None})
    after = Snapshot(subjects={("attribute", "k8s.a"): "stable"})
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=before,
        after=after,
        entries=[],
        lanes=accepted.lanes,
    )
    assert found["candidates"][0]["fromStates"] == {"unknown": 1}


def test_deprecation_domain_and_unbound_namespace_carry_warnings(core, accepted):
    by_id = {c["id"]: c for c in _extract(core, accepted)["candidates"]}
    deprecation = by_id["semantic-conventions@v1.1.0/deprecation/http/deprecated"]
    assert any("earlier decision" in w for w in deprecation["warnings"])
    new = by_id["semantic-conventions@v1.1.0/domain/newns/new"]
    assert new["lane"] is None and any("not bound to any lane" in w for w in new["warnings"])
    assert any("cannot distinguish" in w for w in new["warnings"])


def test_reorganisation_and_rename_are_not_proposed(core, accepted):
    record = _extract(core, accepted)
    ids = " ".join(c["id"] for c in record["candidates"])
    assert "messaging" not in ids  # groups moved to a definition/2 file; the subject is unchanged
    assert "node" not in ids  # node.legacy → node.renamed is not a milestone
    structure = record["method"]["structure"]
    assert structure["groupsAdded"] >= 2 and structure["groupsRemoved"] >= 1
    assert structure["subjectsAddedToExistingNamespaces"] == 1


def test_changelog_promotion_without_structured_change_is_an_ambiguity_not_a_candidate(core, accepted):
    record = _extract(core, accepted)
    assert not any("/process/" in c["id"] for c in record["candidates"])
    assert any(g["kind"] == "ambiguity" and "process" in g["message"] for g in record["gaps"])


def test_namespaces_of_an_accepted_migration_are_not_proposed_again(core, accepted):
    before = Snapshot(subjects={("attribute", "gen_ai.request.model"): "development"})
    after = Snapshot(subjects={("attribute", "gen_ai.request.model"): "deprecated"})
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=before,
        after=after,
        entries=[],
        lanes=accepted.lanes,
    )
    assert found["candidates"] == []
    assert any(g["kind"] == "info" and "already accepted" in g["message"] for g in found["gaps"])


def test_whole_namespace_removal_cannot_be_called_a_removal_for_sure(core, accepted):
    before = Snapshot(subjects={("attribute", "k8s.a"): "stable"})
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=before,
        after=Snapshot(),
        entries=[],
        lanes=accepted.lanes,
    )
    (candidate,) = found["candidates"]
    assert candidate["kind"] == "removed" and any("rename or move" in w for w in candidate["warnings"])


def test_record_is_deterministic_and_has_no_timestamps(core, accepted):
    assert _extract(core, accepted) == _extract(core, accepted)
    assert "T" not in _extract(core, accepted)["date"]


def test_missing_baseline_and_missing_changelog_are_incomplete_not_no_change(core, accepted):
    git = core["git"]
    spec = revisions.release_spec(
        source="semantic-conventions",
        repository="https://r",
        tag="v9.9.9",
        commit=git.tag_commit("v1.0.1"),
        date="2026-03-01",
        baseline_tag=None,
        baseline_commit=None,
    )
    record = revisions.build_record(spec, git, accepted, ["model"])
    assert record["incomplete"] and record["candidates"] == [] and record["compareUrl"] is None
    spec["baselineCommit"], spec["baselineTag"] = git.tag_commit("v1.0.0"), "v1.0.0"
    record = revisions.build_record(spec, git, accepted, ["model"])
    assert any("No CHANGELOG section for v9.9.9" in g["message"] for g in record["gaps"])


def test_late_patch_release_compares_with_the_release_it_patched(core):
    git = core["git"]
    commits = {t: git.tag_commit(t) for t in ("v1.0.0", "v1.0.1", "v1.1.0")}
    assert discovery.nearest_ancestor_release(git, commits["v1.1.0"], commits, "v1.1.0") == (
        "v1.0.0",
        commits["v1.0.0"],
    )
    assert discovery.nearest_ancestor_release(git, commits["v1.0.1"], commits, "v1.0.1")[0] == "v1.0.0"
    assert discovery.nearest_ancestor_release(git, commits["v1.0.0"], commits, "v1.0.0") == (None, None)


def _entry(text, scope=(), body=None):
    return {"scope": list(scope), "text": text, "references": [], "body": body or text}


def test_a_partial_move_suppresses_the_accepted_lane_and_flags_unclaimed_siblings(accepted):
    before = Snapshot(subjects={("attribute", "gen_ai.a"): "development", ("attribute", "anthropic.b"): "development"})
    after = Snapshot(subjects={("attribute", "gen_ai.a"): "deprecated", ("attribute", "anthropic.b"): "deprecated"})
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=before,
        after=after,
        entries=[],
        lanes=accepted.lanes,
    )
    (candidate,) = found["candidates"]  # gen_ai is the accepted move; anthropic is not claimed by any lane
    assert candidate["namespace"] == "anthropic" and candidate["lane"] is None
    assert any("also moves genai (genai-moved)" in w for w in candidate["warnings"])
    assert any(g["kind"] == "info" and "gen_ai" in g["message"] for g in found["gaps"])


def test_a_later_changelog_back_reference_in_the_entry_body_is_an_ambiguity(accepted):
    entries = [
        _entry(
            "`process`: Add process.disk.operations metric",
            ["process"],
            "Add process.disk.operations. Process namespace has been made release candidate in an earlier release.",
        )
    ]
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=Snapshot(subjects={("attribute", "process.a"): "release_candidate"}),
        after=Snapshot(subjects={("attribute", "process.a"): "release_candidate"}),
        entries=entries,
        lanes=accepted.lanes,
    )
    assert found["candidates"] == []
    assert any(g["kind"] == "ambiguity" and "process" in g["message"] for g in found["gaps"])


def test_an_unscoped_entry_that_suggests_a_milestone_is_not_silently_ignored(accepted):
    found = extract_candidates(
        source_id="semantic-conventions",
        review_key="k",
        repository="https://r",
        sha="a" * 40,
        before=Snapshot(),
        after=Snapshot(),
        entries=[_entry("Mark the HTTP conventions as stable")],
        lanes=accepted.lanes,
    )
    assert any("(no scope)" in g["message"] for g in found["gaps"])
