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

"""Fixtures: tiny real git repositories for both sources, a fake GitHub client, accepted history."""

import json
import textwrap
from pathlib import Path

import pytest
from semconv_timeline_watcher import pipeline
from semconv_timeline_watcher.accepted import load_accepted
from semconv_timeline_watcher.gitrepo import GitRepo
from semconv_timeline_watcher.state import Store  # noqa: F401 - re-exported for the tests
from watcher_common.testing import git_commit, init_repo, run_git

REPO = "https://github.com/open-telemetry"


def write(repo: Path, path: str, text: str) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(text).lstrip("\n"), encoding="utf-8")


def commit(repo: Path, message: str, when: str, monkeypatch) -> str:
    monkeypatch.setenv("GIT_COMMITTER_DATE", when)
    monkeypatch.setenv("GIT_AUTHOR_DATE", when)
    run_git(repo, "add", "-A")
    git_commit(repo, message)
    return run_git(repo, "rev-parse", "HEAD")


K8S_V1 = """
    groups:
      - id: registry.k8s
        type: attribute_group
        prefix: k8s
        attributes:
          - id: pod.name
            stability: {pod_name}
          - id: pod.uid
            stability: {pod_uid}
          {extra}
"""
HTTP_V1 = """
    groups:
      - id: registry.http
        type: attribute_group
        prefix: http
        attributes:
          - id: method
            stability: stable
          - id: flavor
            stability: development
            {deprecated}
"""
MESSAGING_V1 = """
    groups:
      - id: registry.messaging
        type: attribute_group
        prefix: messaging
        attributes:
          - id: system
            stability: stable
      - id: messaging.attributes
        type: attribute_group
        attributes:
          - ref: messaging.system
"""
MESSAGING_V2 = """
    file_format: definition/2
    attribute_groups:
      - id: messaging.attributes.common
        attributes:
          - ref: messaging.system
    span_refinements:
      - id: span.messaging.kafka.send
        ref: messaging.send
    attributes:
      - key: messaging.system
        stability: stable
"""
PROCESS_V1 = """
    groups:
      - id: metric.process.cpu.time
        type: metric
        metric_name: process.cpu.time
        stability: development
"""
CHANGELOG_100 = """
    # Changelog

    <!-- next version -->

    ## v1.0.0

    - `k8s`: Initial release ([#1](https://github.com/open-telemetry/semantic-conventions/issues/1))
"""
CHANGELOG_101 = """
    # Changelog

    <!-- next version -->

    ## v1.0.1

    ### Bug fixes

    - `k8s`: Exclude two metrics from code generation ([#9](https://github.com/open-telemetry/semantic-conventions/issues/9))
"""
CHANGELOG_110 = """
    # Changelog

    <!-- next version -->

    ## v1.1.0

    - `k8s`: Promote a selection of k8s attributes to stable ([#10](https://github.com/open-telemetry/semantic-conventions/issues/10))
    - `newns`: Add the newns namespace ([#11](https://github.com/open-telemetry/semantic-conventions/issues/11))
    - `process`: Promote process metrics to release_candidate ([#12](https://github.com/open-telemetry/semantic-conventions/issues/12))
    - `http`: Deprecate `http.flavor` ([#13](https://github.com/open-telemetry/semantic-conventions/issues/13))

    ## v1.0.0

    - `k8s`: Initial release
"""


@pytest.fixture
def core(tmp_path, monkeypatch):
    """A core-like repo: v1.0.0, a patch v1.0.1 cut from a release branch, then v1.1.0 on main."""
    path = tmp_path / "semantic-conventions"
    path.mkdir()
    init_repo(path)
    run_git(path, "checkout", "-b", "main")
    write(
        path,
        "model/k8s/registry.yaml",
        K8S_V1.format(
            pod_name="release_candidate",
            pod_uid="development",
            extra="- id: node.legacy\n            stability: development",
        ),
    )
    write(path, "model/http/registry.yaml", HTTP_V1.format(deprecated=""))
    write(path, "model/messaging/registry.yaml", MESSAGING_V1)
    write(path, "model/process/metrics.yaml", PROCESS_V1)
    write(path, "CHANGELOG.md", CHANGELOG_100)
    shas = {"v1.0.0": commit(path, "release 1.0.0", "2026-01-01T10:00:00+00:00", monkeypatch)}
    run_git(path, "tag", "v1.0.0")

    run_git(path, "checkout", "-b", "release/v1.0.x")
    write(path, "CHANGELOG.md", CHANGELOG_101)
    shas["v1.0.1"] = commit(path, "release 1.0.1", "2026-01-20T10:00:00+00:00", monkeypatch)
    run_git(path, "tag", "v1.0.1")

    run_git(path, "checkout", "main")
    write(
        path,
        "model/k8s/registry.yaml",
        K8S_V1.format(
            pod_name="stable",
            pod_uid="release_candidate",
            extra="- id: node.renamed\n            stability: development",
        ),
    )
    write(path, "model/http/registry.yaml", HTTP_V1.format(deprecated='deprecated: "use network.protocol.name"'))
    (path / "model/messaging/registry.yaml").unlink()
    write(path, "model/messaging/messaging.yaml", MESSAGING_V2)
    write(
        path,
        "model/newns/registry.yaml",
        "groups:\n  - id: registry.newns\n    type: attribute_group\n    prefix: newns\n"
        "    attributes:\n      - id: thing\n        stability: development\n",
    )
    write(path, "CHANGELOG.md", CHANGELOG_110)
    shas["v1.1.0"] = commit(path, "release 1.1.0", "2026-02-01T23:30:00-05:00", monkeypatch)
    run_git(path, "tag", "v1.1.0")
    return {"git": GitRepo(path), "path": path, "shas": shas, "monkeypatch": monkeypatch}


GENAI_REGISTRY = """
    groups:
      - id: registry.gen_ai
        type: attribute_group
        prefix: gen_ai
        attributes:
          - id: request.model
            stability: development
          {extra}
"""


@pytest.fixture
def genai(tmp_path, monkeypatch):
    """A commit-mode repo with no tags: a reviewed start commit, then relevant and irrelevant commits."""
    path = tmp_path / "semantic-conventions-genai"
    path.mkdir()
    init_repo(path)
    run_git(path, "checkout", "-b", "main")
    write(path, "model/gen-ai/registry.yaml", GENAI_REGISTRY.format(extra=""))
    write(path, "docs/gen-ai/spans.md", "spans\n")
    shas = {"start": commit(path, "Prepare standalone GenAI repo", "2026-05-04T20:53:12-07:00", monkeypatch)}
    write(path, "reference/tool.py", "print('x')\n")
    shas["irrelevant"] = commit(path, "Update reference deps", "2026-05-08T10:00:00+00:00", monkeypatch)
    write(
        path,
        "model/gen-ai/registry.yaml",
        GENAI_REGISTRY.format(extra="- id: prompt.version\n            stability: development"),
    )
    write(path, "changelog.d/137.enhancement.md", "Add `gen_ai.prompt.version` attribute.\n")
    shas["relevant"] = commit(path, "Add prompt versioning (#137)", "2026-06-23T14:43:58+00:00", monkeypatch)
    return {"git": GitRepo(path), "path": path, "shas": shas, "monkeypatch": monkeypatch}


class FakeClient:
    """GitHub stand-in: serves canned releases and keeps issues in memory."""

    def __init__(self, releases=None):
        self._releases = releases or []
        self.issues: list[dict] = []
        self.calls: list[tuple] = []

    def releases(self, repo):
        self.calls.append(("releases", repo))
        yield from self._releases

    def find_issue(self, repo, marker, label):
        return next((i for i in self.issues if marker in i["body"]), None)

    def create_issue(self, repo, title, body, labels):
        issue = {"number": len(self.issues) + 1, "title": title, "body": body, "state": "open", "labels": labels}
        self.issues.append(issue)
        return issue

    def update_issue(self, repo, number, **fields):
        self.issues[number - 1].update(fields)

    def comment(self, repo, number, body):
        self.calls.append(("comment", number, body))


def release(tag: str, published: str, *, draft=False, prerelease=False) -> dict:
    return {"tag_name": tag, "published_at": published, "draft": draft, "prerelease": prerelease}


@pytest.fixture
def accepted_file(tmp_path, core, genai):
    """timeline.json declaring v1.0.0 and the GenAI start commit as reviewed."""
    data = {
        "schemaVersion": 1,
        "sources": [
            {
                "id": "semantic-conventions",
                "repository": f"{REPO}/semantic-conventions",
                "mode": "release",
                "paths": ["CHANGELOG.md", "docs", "model"],
                "reviewedThrough": {"tag": "v1.0.0", "commit": core["shas"]["v1.0.0"]},
            },
            {
                "id": "semantic-conventions-genai",
                "repository": f"{REPO}/semantic-conventions-genai",
                "mode": "commit",
                "paths": ["changelog.d", "docs", "model"],
                "reviewedThrough": {"commit": genai["shas"]["start"]},
            },
        ],
        "releases": [
            {
                "key": "semantic-conventions@v1.0.0",
                "tag": "v1.0.0",
                "commit": core["shas"]["v1.0.0"],
                "date": "2026-01-01",
                "dateBasis": "release-published-at",
            }
        ],
        "lanes": [
            {"id": "k8s", "title": "Kubernetes", "subtitle": "x", "namespaces": ["k8s", "container"]},
            {"id": "http", "title": "HTTP", "subtitle": "x", "namespaces": ["http"]},
            {"id": "messaging", "title": "Messaging", "subtitle": "x", "namespaces": ["messaging"]},
            {
                "id": "genai",
                "title": "GenAI",
                "subtitle": "x",
                "namespaces": ["gen-ai"],
                "migration": {
                    "eventId": "genai-moved",
                    "from": "semantic-conventions",
                    "to": "semantic-conventions-genai",
                },
            },
        ],
        "events": [
            {"id": "k8s-existing", "lane": "k8s", "revision": "semantic-conventions@v1.0.0", "type": "stability"},
            {"id": "genai-moved", "lane": "genai", "revision": "semantic-conventions@v1.0.0", "type": "moved"},
            {"id": "http-new", "lane": "http", "revision": "semantic-conventions@v1.0.0", "type": "deprecation"},
        ],
    }
    path = tmp_path / "timeline.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


@pytest.fixture
def accepted(accepted_file):
    return load_accepted(accepted_file)


CORE, GENAI = pipeline.CORE, pipeline.GENAI
RELEASES = [
    release("v1.0.0", "2026-01-01T10:00:00Z"),
    release("v1.0.1", "2026-01-20T10:00:00Z"),
    release("v1.1.0", "2026-02-02T04:30:00Z"),
    release("v1.2.0", "2026-03-01T00:00:00Z", draft=True),
    release("v1.3.0-rc.1", "2026-03-05T00:00:00Z", prerelease=True),
]


def run_core(store, accepted, core, state=None, **opts):
    return pipeline.process_core(
        store, accepted, core["git"], FakeClient(RELEASES), state or pipeline.empty_source_state(), opts
    )


def run_genai(store, accepted, genai, state=None, **opts):
    return pipeline.process_genai(store, accepted, genai["git"], state or pipeline.empty_source_state(), opts, "main")
