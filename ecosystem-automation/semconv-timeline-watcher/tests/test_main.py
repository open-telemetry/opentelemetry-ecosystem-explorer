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

"""CLI wiring: argument validation, per-source isolation, exit codes and the check/review commands."""

import json

import pytest
from semconv_timeline_watcher import main as cli
from semconv_timeline_watcher.accepted import load_accepted
from semconv_timeline_watcher.github_client import GitHubError
from semconv_timeline_watcher.state import Store

from .conftest import CORE, GENAI, RELEASES, FakeClient


def parse(*argv):
    return cli.build_parser().parse_args(list(argv))


def test_manual_replay_arguments_are_validated():
    parser = cli.build_parser()
    ok = parse("run", "--source", CORE, "--tag", "v1.1.0")
    assert cli._validate_run_args(ok, parser) == [CORE]
    for argv in [
        ["run", "--tag", "v1.1.0"],  # a replay must name its single source
        ["run", "--source", CORE, "--source", GENAI, "--from", "a1"],
        ["run", "--source", GENAI, "--to", "main"],
        ["run", "--source", CORE, "--from", "v1.0.0"],
        ["run", "--source", GENAI, "--tag", "v1.0.0"],
    ]:
        with pytest.raises(SystemExit):
            cli._validate_run_args(parse(*argv), parser)
    for bad in ["--tag=-x", "--tag=a b", "--from=$(x)", "--to=;ls"]:
        with pytest.raises(SystemExit):
            parse("run", "--source", CORE, bad)


def test_a_failing_source_does_not_block_or_corrupt_the_other(tmp_path, accepted, accepted_file, core, genai):
    class Broken(FakeClient):
        def releases(self, repo):
            raise GitHubError("GET releases failed: 503")

    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "run")
    store = Store(tmp_path / "reg" / CORE)
    store.save_state(
        {"schemaVersion": 1, "sources": {CORE: {"cursor": "keep", "order": [], "reconcile": [], "revisions": {}}}}
    )
    code = cli.run_command(
        args, [CORE, GENAI], accepted, client=Broken(), repos={CORE: core["git"], GENAI: genai["git"]}, head_ref="HEAD"
    )
    state = Store(tmp_path / "reg" / CORE).load_state()
    assert code == 1
    assert state["sources"][CORE]["cursor"] == "keep"  # failed source: previous state retained
    genai_state = Store(tmp_path / "reg" / GENAI).load_state()
    assert list(genai_state["sources"][GENAI]["revisions"]) == [f"{GENAI}@{genai['shas']['start'][:12]}.."]


def test_a_clean_run_succeeds_and_check_enforces_dispositions(tmp_path, accepted, accepted_file, core, genai, capsys):
    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "run")
    code = cli.run_command(
        args,
        [CORE, GENAI],
        accepted,
        client=FakeClient(RELEASES),
        repos={CORE: core["git"], GENAI: genai["git"]},
        head_ref="HEAD",
    )
    assert code == 0 and cli.check_command(args, accepted) == 0
    store = Store(tmp_path / "reg" / CORE)
    key = f"{CORE}@v1.1.0"
    record = store.read_record(CORE, key)
    record["candidates"][0]["disposition"] = {"status": "accepted", "eventId": "missing-event"}
    store.write_record(record)
    assert cli.check_command(args, accepted) == 1
    assert "missing-event" in capsys.readouterr().err


def test_check_reports_a_reconciliation_and_a_missing_candidate_file(tmp_path, accepted, accepted_file, core, capsys):
    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "check")
    store = Store(tmp_path / "reg" / CORE)
    store.save_state(
        {
            "schemaVersion": 1,
            "sources": {
                CORE: {
                    "cursor": None,
                    "order": [],
                    "revisions": {f"{CORE}@v9": {"kind": "release", "source": CORE, "commit": "x"}},
                    "reconcile": [{"key": f"{CORE}@v1.0.0", "expected": "a", "actual": "b"}],
                }
            },
        }
    )
    assert cli.check_command(args, accepted) == 1
    err = capsys.readouterr().err
    assert "candidate file is missing" in err and "now resolves to b" in err


def test_review_command_needs_a_repository_and_upserts(
    tmp_path, accepted, accepted_file, core, genai, monkeypatch, capsys
):
    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "run")
    cli.run_command(args, [CORE], accepted, client=FakeClient(RELEASES), repos={CORE: core["git"]}, head_ref="HEAD")
    review_args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "review")
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    assert cli.review_command(review_args, accepted, client=FakeClient()) == 1
    monkeypatch.setenv("GITHUB_REPOSITORY", "o/r")
    client = FakeClient()
    assert cli.review_command(review_args, accepted, client=client) == 0
    assert len(client.issues) == 2
    assert cli.review_command(review_args, accepted, client=client) == 0 and len(client.issues) == 2


def test_the_cli_never_modifies_accepted_history(tmp_path, accepted, accepted_file, core, genai):
    before = accepted_file.read_bytes()
    args = parse("--registry-dir", str(tmp_path / "reg"), "--timeline", str(accepted_file), "run")
    cli.run_command(
        args,
        [CORE, GENAI],
        accepted,
        client=FakeClient(RELEASES),
        repos={CORE: core["git"], GENAI: genai["git"]},
        head_ref="HEAD",
    )
    assert accepted_file.read_bytes() == before
    assert load_accepted(accepted_file).reviewed_through(CORE)["tag"] == "v1.0.0"
    assert json.loads(before)["sources"][1]["reviewedThrough"]["commit"] == genai["shas"]["start"]
