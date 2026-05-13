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
from unittest.mock import MagicMock, patch

import pytest
from dotnet_instrumentation_watcher.dotnet_client import (
    DotNetInstrumentationClient,
    NuGetAPIError,
)
from requests import RequestException


def _make_index_response():
    """Return a mock NuGet service index response."""
    mock = MagicMock()
    mock.json.return_value = {"resources": [{"@id": "https://api.test/query", "@type": "SearchQueryService"}]}
    return mock


def test_get_core_version_success():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_get.side_effect = [
            _make_index_response(),
            MagicMock(**{"json.return_value": {"data": [{"version": "1.15.3"}]}}),
        ]

        version = client.get_core_version()
        assert version == "1.15.3"
        assert mock_get.call_count == 2


def test_get_core_version_raises_on_api_error():
    """get_core_version should propagate NuGetAPIError instead of returning a fallback."""
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_get.side_effect = RequestException("API error")
        with pytest.raises(NuGetAPIError):
            client.get_core_version()


def test_get_search_url_raises_when_service_index_missing_resource():
    """_get_search_url should raise NuGetAPIError if no SearchQueryService is in the index."""
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"resources": []}  # no SearchQueryService entry
        mock_get.return_value = mock_resp
        with pytest.raises(NuGetAPIError, match="SearchQueryService"):
            client._get_search_url()


def test_fetch_instrumentation_list():
    """Packages are filtered by deprecation flag only; prerelease versions are supported."""
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_search_response = MagicMock()
        mock_search_response.json.return_value = {
            "data": [
                # Stable instrumentation
                {
                    "id": "OpenTelemetry.Instrumentation.Test",
                    "version": "1.0.0",
                    "description": "Test instrumentation",
                },
                # Stable exporter
                {
                    "id": "OpenTelemetry.Exporter.Test",
                    "version": "1.1.0",
                    "description": "Test exporter",
                },
                # Extension with a prerelease version (e.g. 1.2.3-preview.4)
                {
                    "id": "OpenTelemetry.Extensions.Test",
                    "version": "1.2.3-preview.4",
                    "description": "Test extension",
                },
                # Deprecated by NuGet — must be skipped
                {
                    "id": "OpenTelemetry.Exporter.Deprecated",
                    "version": "0.1.0",
                    "deprecation": {"reasons": ["Legacy"]},
                },
                # Contrib package — deprecated in NuGet, so covered by the deprecation check
                {
                    "id": "OpenTelemetry.Contrib.Instrumentation.Legacy",
                    "version": "1.0.0",
                    "description": "Legacy contrib package",
                    "deprecation": {"reasons": ["Legacy"]},
                },
            ]
        }
        mock_get.side_effect = [_make_index_response(), mock_search_response]

        result = client.fetch_instrumentation_list()
        assert "modules" in result
        # 3 valid packages (1 deprecated + 1 deprecated contrib are skipped)
        assert len(result["modules"]) == 3

        types = [m["type"] for m in result["modules"]]
        assert "instrumentation" in types
        assert "exporter" in types
        assert "extension" in types

        # Sorted by name: Exporter.Test, Extensions.Test, Instrumentation.Test
        assert result["modules"][0]["name"] == "OpenTelemetry.Exporter.Test"
        assert result["modules"][0]["version"] == "1.1.0"

        # Extension carries a prerelease version — must be preserved as-is
        assert result["modules"][1]["name"] == "OpenTelemetry.Extensions.Test"
        assert result["modules"][1]["version"] == "1.2.3-preview.4"

        assert result["modules"][2]["name"] == "OpenTelemetry.Instrumentation.Test"
        assert result["modules"][2]["version"] == "1.0.0"
