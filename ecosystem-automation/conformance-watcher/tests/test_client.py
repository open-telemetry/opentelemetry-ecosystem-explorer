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
"""Tests for ConformanceClient."""

import json
from unittest.mock import MagicMock

import pytest
from conformance_watcher.client import ConformanceClient


def test_resolve_revision_already_sha() -> None:
    client = ConformanceClient()
    sha = "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
    resolved = client.resolve_revision(sha)
    assert resolved == sha


def test_resolve_revision_default_queries_commits_for_path() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"sha": "6F85D0AA70EB55116D161C5C0737A6BA55FAF101"}]
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    resolved = client.resolve_revision(None)
    assert resolved == "6f85d0aa70eb55116d161c5c0737a6ba55faf101"

    mock_session.get.assert_called_once()
    _, kwargs = mock_session.get.call_args
    assert kwargs.get("params") == {"path": "docs/data/conformance.json", "per_page": 1}


def test_resolve_revision_branch_via_api() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"sha": "6F85D0AA70EB55116D161C5C0737A6BA55FAF101"}]
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    resolved = client.resolve_revision("main")
    assert resolved == "6f85d0aa70eb55116d161c5c0737a6ba55faf101"


def test_resolve_revision_api_failure() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.text = "Not Found"
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    with pytest.raises(RuntimeError, match="Failed to query commits"):
        client.resolve_revision(None)


def test_get_latest_commit_for_path_empty() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    with pytest.raises(RuntimeError, match="No commits found for path"):
        client.get_latest_commit_for_path()


def test_client_headers_with_token() -> None:
    client = ConformanceClient(token="test-token")
    headers = client._headers()
    assert headers["Authorization"] == "Bearer test-token"
    assert "User-Agent" in headers


def test_fetch_report_success() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    sample_data = {
        "schema_version": 1,
        "domains": {},
        "registry": {},
        "targets": [],
    }
    mock_response.json.return_value = sample_data
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    report_data, formatted_bytes, digest = client.fetch_report("6f85d0aa70eb55116d161c5c0737a6ba55faf101")

    assert report_data == sample_data
    assert digest.startswith("sha256:")
    assert len(digest) == 7 + 64
    assert formatted_bytes.endswith(b"\n")
    assert json.loads(formatted_bytes.decode("utf-8")) == sample_data


def test_fetch_report_contents_api_fallback() -> None:
    mock_session = MagicMock()
    resp_raw = MagicMock()
    resp_raw.status_code = 404
    resp_raw.text = "Not Found"

    resp_api = MagicMock()
    resp_api.status_code = 200
    sample_data = {"schema_version": 1, "domains": {}, "registry": {}, "targets": []}
    resp_api.json.return_value = sample_data

    mock_session.get.side_effect = [resp_raw, resp_api]

    client = ConformanceClient(session=mock_session)
    report_data, formatted_bytes, digest = client.fetch_report("6f85d0aa70eb55116d161c5c0737a6ba55faf101")
    assert report_data == sample_data
    assert mock_session.get.call_count == 2


def test_fetch_report_invalid_json() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.side_effect = json.JSONDecodeError("Expecting value", "doc", 0)
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    with pytest.raises(ValueError, match="is not valid JSON"):
        client.fetch_report("6f85d0aa70eb55116d161c5c0737a6ba55faf101")


def test_fetch_report_root_not_dict() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = ["not", "a", "dict"]
    mock_session.get.return_value = mock_response

    client = ConformanceClient(session=mock_session)
    with pytest.raises(ValueError, match="root is not a JSON object"):
        client.fetch_report("6f85d0aa70eb55116d161c5c0737a6ba55faf101")
