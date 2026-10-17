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

"""Static checks of the nightly workflow: triggers, concurrency, permissions, pinning and the trust boundary.

GitHub Actions itself is not run here; these tests pin the properties that can be verified from the file.
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

WORKFLOW = Path(__file__).resolve().parents[3] / ".github/workflows/nightly-semconv-timeline.yml"


@pytest.fixture(scope="module")
def workflow():
    return yaml.safe_load(WORKFLOW.read_text())


def steps_of(job):
    return job.get("steps", [])


def test_runs_nightly_and_on_demand_with_replay_inputs(workflow):
    triggers = workflow[True]  # PyYAML reads the bare key `on` as a boolean
    assert triggers["schedule"] and set(triggers["workflow_dispatch"]["inputs"]) == {
        "source",
        "tag",
        "from",
        "to",
        "force",
    }
    assert triggers["workflow_dispatch"]["inputs"]["source"]["options"] == [
        "all",
        "semantic-conventions",
        "semantic-conventions-genai",
    ]


def test_overlapping_runs_queue_instead_of_racing(workflow):
    assert workflow["concurrency"] == {"group": "${{ github.workflow }}", "cancel-in-progress": False}
    assert workflow["permissions"] == {"contents": "read"}


def test_each_source_has_an_isolated_discover_review_chain_and_failures_notify(workflow):
    jobs = workflow["jobs"]
    assert set(jobs) == {"validate-inputs", "core-discover", "core-review", "genai-discover", "genai-review", "notify"}
    assert jobs["core-review"]["needs"] == ["core-discover"] and jobs["genai-review"]["needs"] == ["genai-discover"]
    assert set(jobs["notify"]["needs"]) == set(jobs) - {"notify", "validate-inputs"}
    assert "failure" in jobs["notify"]["with"]["success"]
    for source, short in (("semantic-conventions", "core"), ("semantic-conventions-genai", "genai")):
        discover = jobs[f"{short}-discover"]
        assert discover["needs"] == ["validate-inputs"]
        forwarded = f"${{{{ needs.validate-inputs.outputs.{short}-args }}}}"
        assert (
            discover["with"]["watcher-command"] == f"uv run semconv-timeline-watcher run --source {source}{forwarded}"
        )
        assert discover["with"]["registry-path"] == f"ecosystem-registry/semantic-conventions/{source}/"
        assert discover["with"]["branch-name"] == f"otelbot/automated-semconv-timeline-{short}"
        assert discover["permissions"] == {"contents": "write", "pull-requests": "write"}


def test_the_privileged_review_job_never_executes_code_from_the_automation_branch(workflow):
    for short in ("core", "genai"):
        job = workflow["jobs"][f"{short}-review"]
        assert job["permissions"] == {"contents": "read", "issues": "write", "pull-requests": "read"}
        checkouts = [s for s in steps_of(job) if str(s.get("uses", "")).startswith("actions/checkout")]
        branch = [s for s in checkouts if "ref" in s.get("with", {})]
        assert len(checkouts) == 2 and len(branch) == 1
        assert branch[0]["with"]["path"] == "automation-data"  # data only, in its own directory
        assert all(s["with"]["persist-credentials"] is False for s in checkouts)
        trusted = [s for s in checkouts if s not in branch][0]
        assert "path" not in trusted["with"] and "ref" not in trusted["with"]  # the default branch, at the root
        runs = "\n".join(s["run"] for s in steps_of(job) if "run" in s)
        assert "uv sync --locked" in runs and "automation-data" not in runs  # nothing runs from the branch directory
        env_registry = [s["env"]["REGISTRY_DIR"] for s in steps_of(job) if "REGISTRY_DIR" in s.get("env", {})]
        assert env_registry and all("automation-data/ecosystem-registry" in e for e in env_registry)


def test_review_creates_issues_before_the_check_that_fails_the_job(workflow):
    for short in ("core", "genai"):
        names = [s.get("name") for s in steps_of(workflow["jobs"][f"{short}-review"])]
        assert names.index("Create or update review issues") < names.index("Validate state and dispositions")
        check = [
            s
            for s in steps_of(workflow["jobs"][f"{short}-review"])
            if s.get("name") == "Validate state and dispositions"
        ][0]
        assert check["if"] == "${{ !cancelled() }}"


def test_third_party_actions_are_pinned_to_commit_shas(workflow):
    for job in workflow["jobs"].values():
        for step in steps_of(job):
            uses = step.get("uses")
            if uses and not uses.startswith("./"):
                assert re.search(r"@[0-9a-f]{40}\b", uses), uses


def run_validation(workflow, tmp_path, **inputs):
    """Run the validate-inputs script exactly as written in the workflow, with GitHub's env-var contract."""
    step = [s for s in steps_of(workflow["jobs"]["validate-inputs"]) if s.get("id") == "args"][0]
    output = tmp_path / "github_output"
    output.write_text("")
    env = {"PATH": "/usr/bin:/bin", "GITHUB_OUTPUT": str(output)}
    defaults = {"source": "all", "tag": "", "from": "", "to": "", "force": "false"}
    for name, key in (("SOURCE", "source"), ("TAG", "tag"), ("FROM_REF", "from"), ("TO_REF", "to"), ("FORCE", "force")):
        env[name] = str(inputs.get(key, defaults[key]))
    assert set(step["env"]) == set(env) - {"PATH", "GITHUB_OUTPUT"}
    # The script is the repository's own workflow step, run with a fixed environment; no untrusted input.
    done = subprocess.run(  # noqa: S603
        [shutil.which("bash") or "/bin/bash", "-c", step["run"]], env=env, capture_output=True, text=True, check=False
    )
    outputs = dict(line.split("=", 1) for line in output.read_text().splitlines())
    return done.returncode, done.stdout, outputs


def test_discover_jobs_run_only_after_the_inputs_are_validated(workflow):
    assert workflow["jobs"]["validate-inputs"]["permissions"] == {}
    for short in ("core", "genai"):
        assert workflow["jobs"][f"{short}-discover"]["needs"] == ["validate-inputs"]
        assert "if" not in workflow["jobs"][f"{short}-discover"]["needs"]  # an implicit success() gate applies


@pytest.mark.parametrize("source", ["", "all"])
def test_a_default_run_forwards_nothing_and_covers_both_sources(workflow, tmp_path, source):
    code, _, outputs = run_validation(workflow, tmp_path, source=source)
    assert code == 0 and outputs == {"core-args": "", "genai-args": ""}


def test_a_scheduled_run_has_no_inputs_at_all(workflow, tmp_path):
    code, _, outputs = run_validation(workflow, tmp_path, source="", force="")
    assert code == 0 and outputs == {"core-args": "", "genai-args": ""}


def test_an_explicit_source_without_replay_inputs_forwards_nothing(workflow, tmp_path):
    for source in ("semantic-conventions", "semantic-conventions-genai"):
        code, _, outputs = run_validation(workflow, tmp_path, source=source)
        assert code == 0 and outputs == {"core-args": "", "genai-args": ""}


def test_a_core_tag_replay_reaches_only_the_core_watcher(workflow, tmp_path):
    code, _, outputs = run_validation(workflow, tmp_path, source="semantic-conventions", tag="v1.45.0")
    assert code == 0 and outputs == {"core-args": " --tag v1.45.0", "genai-args": ""}


def test_a_core_range_needs_both_ends_and_is_forwarded_in_order(workflow, tmp_path):
    code, _, outputs = run_validation(
        workflow, tmp_path, source="semantic-conventions", **{"from": "v1.44.0", "to": "v1.45.0"}
    )
    assert code == 0 and outputs == {"core-args": " --from v1.44.0 --to v1.45.0", "genai-args": ""}
    code, out, _ = run_validation(workflow, tmp_path, source="semantic-conventions", **{"from": "v1.44.0"})
    assert code == 1 and "core range needs both" in out


def test_a_genai_range_reaches_only_the_genai_watcher_and_may_be_open_ended(workflow, tmp_path):
    code, _, outputs = run_validation(
        workflow, tmp_path, source="semantic-conventions-genai", **{"from": "ebe3d1fb9fdd", "to": "main"}
    )
    assert code == 0 and outputs == {"core-args": "", "genai-args": " --from ebe3d1fb9fdd --to main"}
    code, _, outputs = run_validation(
        workflow, tmp_path, source="semantic-conventions-genai", **{"from": "ebe3d1fb9fdd"}
    )
    assert code == 0 and outputs["genai-args"] == " --from ebe3d1fb9fdd"


@pytest.mark.parametrize(
    "inputs",
    [
        {"tag": "v1.45.0"},
        {"from": "v1.44.0", "to": "v1.45.0"},
        {"to": "v1.45.0"},
        {"force": "true"},
        {"source": "", "tag": "v1.45.0"},
    ],
)
def test_replay_inputs_without_a_single_source_fail_instead_of_being_dropped(workflow, tmp_path, inputs):
    code, out, outputs = run_validation(workflow, tmp_path, **inputs)
    assert code == 1 and "single source" in out and "semantic-conventions-genai" in out
    assert outputs == {}  # nothing is forwarded


@pytest.mark.parametrize(
    ("inputs", "message"),
    [
        ({"source": "semantic-conventions", "to": "v1.45.0"}, "'to' needs 'from'"),
        ({"source": "semantic-conventions-genai", "to": "main"}, "'to' needs 'from'"),
        ({"source": "semantic-conventions", "tag": "v1.45.0", "from": "v1.44.0"}, "cannot be combined"),
        ({"source": "semantic-conventions", "tag": "v1.45.0", "to": "v1.45.0"}, "'to' needs 'from'"),
        ({"source": "semantic-conventions-genai", "tag": "v1.45.0"}, "published core release"),
        ({"source": "semantic-conventions", "tag": "--force"}, "not a plain tag"),
        ({"source": "semantic-conventions", "tag": "v1 --force"}, "not a plain tag"),
    ],
)
def test_incomplete_or_contradictory_replay_arguments_are_rejected_with_a_reason(workflow, tmp_path, inputs, message):
    code, out, outputs = run_validation(workflow, tmp_path, **inputs)
    assert code == 1 and message in out and outputs == {}


def test_force_is_off_by_default_and_forwarded_only_to_the_chosen_source(workflow, tmp_path):
    code, _, outputs = run_validation(workflow, tmp_path, source="semantic-conventions", tag="v1.45.0")
    assert code == 0 and "--force" not in outputs["core-args"]
    code, _, outputs = run_validation(workflow, tmp_path, source="semantic-conventions", tag="v1.45.0", force="true")
    assert outputs == {"core-args": " --tag v1.45.0 --force", "genai-args": ""}
    code, _, outputs = run_validation(workflow, tmp_path, source="semantic-conventions-genai", force="true")
    assert code == 0 and outputs == {"core-args": "", "genai-args": " --force"}


def test_the_ci_pipeline_runs_this_packages_tests_on_pull_requests():
    ci = yaml.safe_load((WORKFLOW.parent / "build-and-test.yml").read_text())
    job = ci["jobs"]["test-automation-semconv-timeline-watcher"]
    runs = "\n".join(s["run"] for s in job["steps"] if "run" in s)
    assert "uv sync --locked" in runs and "cd ecosystem-automation/semconv-timeline-watcher" in runs
    assert "pytest tests/" in runs and "--cov=semconv_timeline_watcher" in runs
    assert ci[True]["pull_request"]["branches"] == ["main"]
