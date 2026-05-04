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
"""Tests for ReadmeExtractor."""

from unittest.mock import Mock

import pytest
from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError
from java_instrumentation_watcher.readme_extractor import ReadmeExtractor


@pytest.fixture
def mock_client():
    return Mock()


@pytest.fixture
def extractor(mock_client):
    return ReadmeExtractor(mock_client)


def test_discover_library_readmes_mixed_entries(extractor, mock_client):
    mock_client.fetch_tree.return_value = [
        {"type": "tree", "path": "instrumentation/akka"},
        {"type": "blob", "path": "instrumentation/akka/akka-actor-2.3/library/README.md"},
        {"type": "blob", "path": "instrumentation/apache-httpclient/apache-httpclient-4.3/library/README.md"},
        {"type": "blob", "path": "instrumentation/akka/akka-actor-2.3/javaagent/README.md"},  # not library/
        {"type": "blob", "path": "README.md"},  # top-level, no match
        {"type": "blob", "path": "docs/instrumentation-list.yaml"},
    ]

    result = extractor.discover_library_readmes("abc123")

    assert result == {
        "instrumentation/akka/akka-actor-2.3": "instrumentation/akka/akka-actor-2.3/library/README.md",
        "instrumentation/apache-httpclient/apache-httpclient-4.3": "instrumentation/apache-httpclient/apache-httpclient-4.3/library/README.md",
    }


def test_discover_library_readmes_empty_tree(extractor, mock_client):
    mock_client.fetch_tree.return_value = []

    result = extractor.discover_library_readmes("abc123")

    assert result == {}


def test_discover_library_readmes_propagates_api_error(extractor, mock_client):
    mock_client.fetch_tree.side_effect = GithubAPIError("network error")

    with pytest.raises(GithubAPIError, match="network error"):
        extractor.discover_library_readmes("abc123")


def test_fetch_readme_delegates_to_client(extractor, mock_client):
    mock_client.fetch_raw_file.return_value = "# Hello"

    result = extractor.fetch_readme("instrumentation/akka/akka-actor-2.3/library/README.md", "abc123")

    assert result == "# Hello"
    mock_client.fetch_raw_file.assert_called_once_with(
        "instrumentation/akka/akka-actor-2.3/library/README.md", "abc123"
    )


def test_discover_library_readmes_nested_path(extractor, mock_client):
    mock_client.fetch_tree.return_value = [
        {"type": "blob", "path": "instrumentation/a/b/c/library/README.md"},
    ]

    result = extractor.discover_library_readmes("sha")

    assert "instrumentation/a/b/c" in result
    assert result["instrumentation/a/b/c"] == "instrumentation/a/b/c/library/README.md"
