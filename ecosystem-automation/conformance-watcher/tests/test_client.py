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


def test_resolve_revision_branch_via_api() -> None:
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"sha": "6F85D0AA70EB55116D161C5C0737A6BA55FAF101"}
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
    with pytest.raises(RuntimeError, match="Failed to resolve ref"):
        client.resolve_revision("unknown-branch")


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
    report_data, canonical_bytes, full_digest, snapshot_id = client.fetch_report(
        "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
    )

    assert report_data == sample_data
    assert len(full_digest) == 64
    assert len(snapshot_id) == 12
    assert snapshot_id == full_digest[:12]
    # Check that canonical_bytes is valid JSON matching sample_data
    assert json.loads(canonical_bytes.decode("utf-8")) == sample_data
