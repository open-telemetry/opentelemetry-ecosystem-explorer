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

"""Release discovery, range coalescing and the GitHub client."""

from unittest.mock import MagicMock

import pytest
import requests
from semconv_timeline_watcher import discovery
from semconv_timeline_watcher.github_client import GitHubClient, GitHubError

from .conftest import FakeClient, commit, release, write


def test_only_published_releases_are_selected_in_a_fixed_order():
    client = FakeClient(
        [
            release("v1.2.0", "2026-03-01T00:00:00Z"),
            release("v1.3.0", "2026-04-01T00:00:00Z", draft=True),
            release("v1.4.0-rc.1", "2026-04-05T00:00:00Z", prerelease=True),
            {"tag_name": "v1.5.0", "published_at": None, "draft": False, "prerelease": False},
            release("v1.1.0", "2026-02-01T00:00:00Z"),
            release("v1.2.0", "2026-03-01T00:00:00Z"),  # repeated across pages
        ]
    )
    assert [r["tag"] for r in discovery.published_releases(client, "o/r")] == ["v1.1.0", "v1.2.0"]
    reversed_client = FakeClient(list(reversed(client._releases)))
    assert discovery.published_releases(reversed_client, "o/r") == discovery.published_releases(client, "o/r")


def test_tags_resolve_to_immutable_commits_and_missing_tags_are_reported(core):
    commits, errors = discovery.resolve_tags(core["git"], ["v1.0.0", "v9.9.9"])
    assert commits == {"v1.0.0": core["shas"]["v1.0.0"]}
    assert "v9.9.9" in errors


def test_coalesce_merges_overlap_and_keeps_gaps_apart(genai):
    git, monkeypatch, path = genai["git"], genai["monkeypatch"], genai["path"]
    write(path, "docs/gen-ai/more.md", "more\n")
    third = commit(path, "more docs", "2026-07-01T00:00:00+00:00", monkeypatch)
    write(path, "docs/gen-ai/gap.md", "gap\n")
    fourth = commit(path, "gap", "2026-07-02T00:00:00+00:00", monkeypatch)
    write(path, "docs/gen-ai/tail.md", "tail\n")
    fifth = commit(path, "tail", "2026-07-03T00:00:00+00:00", monkeypatch)
    s = genai["shas"]
    merged = discovery.coalesce(
        git, [(s["start"], s["relevant"]), (s["irrelevant"], third), (s["start"], s["relevant"]), (fourth, fifth)]
    )
    assert merged == sorted([(s["start"], third), (fourth, fifth)])
    assert discovery.coalesce(git, [(fourth, fifth), (s["start"], s["relevant"])]) == sorted(
        [(s["start"], s["relevant"]), (fourth, fifth)]
    )


def _session(*pages):
    session = MagicMock()
    session.headers = {}
    responses = []
    for page in pages:
        response = MagicMock()
        response.json.return_value = page
        responses.append(response)
    session.request.side_effect = responses
    return session


def test_releases_are_paginated_until_a_short_page():
    full = [{"tag_name": f"v1.{i}.0"} for i in range(100)]
    session = _session(full, [{"tag_name": "v2.0.0"}])
    tags = [r["tag_name"] for r in GitHubClient("t", session).releases("o/r")]
    assert len(tags) == 101 and tags[-1] == "v2.0.0"
    assert [c.kwargs["params"]["page"] for c in session.request.call_args_list] == [1, 2]
    assert session.headers["Authorization"] == "Bearer t"


def test_issue_lookup_matches_the_marker_and_skips_pull_requests():
    session = _session(
        [{"number": 1, "body": "<!-- m -->", "pull_request": {}}, {"number": 2, "body": "x <!-- m --> y"}]
    )
    assert GitHubClient(None, session).find_issue("o/r", "<!-- m -->", "label")["number"] == 2


def test_api_failures_raise_a_clear_error():
    session = MagicMock()
    session.headers = {}
    session.request.side_effect = requests.ConnectionError("down")
    with pytest.raises(GitHubError, match="releases"):
        list(GitHubClient(None, session).releases("o/r"))
