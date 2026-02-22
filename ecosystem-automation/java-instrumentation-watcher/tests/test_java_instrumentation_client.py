# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
from unittest.mock import Mock, patch

import pytest
import requests
from java_instrumentation_watcher.java_instrumentation_client import (
    GithubAPIError,
    JavaInstrumentationClient,
)


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_get_latest_release_tag_success(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.json.return_value = {"tag_name": "v2.24.0"}
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()
    tag = client.get_latest_release_tag()

    assert tag == "v2.24.0"
    mock_session.get.assert_called_once_with(
        "https://api.github.com/repos/open-telemetry/opentelemetry-java-instrumentation/releases/latest", timeout=30
    )


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_fetch_instrumentation_file(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.text = "instrumentations:\n  - id: test\n"
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()
    content = client.fetch_instrumentation_list(ref="2.24.0")
    assert "instrumentations:" in content
    mock_session.get.assert_called_once_with(
        "https://raw.githubusercontent.com/open-telemetry/opentelemetry-java-instrumentation/2.24.0/docs/instrumentation-list.yaml",
        timeout=30,
    )


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_get_latest_release_tag_http_error(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()

    with pytest.raises(GithubAPIError, match="Error fetching latest release tag"):
        client.get_latest_release_tag()


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_get_latest_release_tag_invalid_json(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.json.side_effect = ValueError("Invalid JSON")
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()

    with pytest.raises(GithubAPIError, match="Unexpected API response format"):
        client.get_latest_release_tag()


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_get_latest_release_tag_missing_tag_name(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.json.return_value = {"name": "Release 2.24.0"}  # Missing tag_name
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()

    with pytest.raises(GithubAPIError, match="Unexpected API response format"):
        client.get_latest_release_tag()


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_fetch_instrumentation_list_http_error(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    mock_response = Mock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
    mock_session.get.return_value = mock_response

    client = JavaInstrumentationClient()

    with pytest.raises(GithubAPIError, match="Error fetching instrumentation list"):
        client.fetch_instrumentation_list(ref="v2.24.0")


@patch("java_instrumentation_watcher.java_instrumentation_client.requests.Session")
def test_client_with_auth_token(mock_session_class):
    mock_session = Mock()
    mock_session_class.return_value = mock_session

    JavaInstrumentationClient(github_token="test_token_123")

    mock_session.headers.update.assert_called_once_with({"Authorization": "Bearer test_token_123"})
