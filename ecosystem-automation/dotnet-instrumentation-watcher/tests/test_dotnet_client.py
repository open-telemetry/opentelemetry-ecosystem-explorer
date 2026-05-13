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

from dotnet_instrumentation_watcher.dotnet_client import DotNetInstrumentationClient


def test_get_core_version_success():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_index_response = MagicMock()
        mock_index_response.json.return_value = {
            "resources": [{"@id": "https://api.test/query", "@type": "SearchQueryService"}]
        }
        mock_core_response = MagicMock()
        mock_core_response.json.return_value = {"data": [{"version": "1.15.3"}]}

        mock_get.side_effect = [mock_index_response, mock_core_response]

        version = client.get_core_version()
        assert version == "1.15.3"
        assert mock_get.call_count == 2


def test_get_core_version_error():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        from requests import RequestException

        mock_get.side_effect = RequestException("API error")
        version = client.get_core_version()
        # It will try to fetch index, fail, use fallback URL, try again, fail
        assert version == "1.0.0"  # Default fallback


def test_fetch_instrumentation_list():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_index_response = MagicMock()
        mock_index_response.json.return_value = {
            "resources": [{"@id": "https://api.test/query", "@type": "SearchQueryService"}]
        }
        mock_search_response = MagicMock()
        mock_search_response.json.return_value = {
            "data": [
                {"id": "OpenTelemetry.Instrumentation.Test", "version": "1.0.0", "description": "Test instrumentation"},
                {"id": "OpenTelemetry.Exporter.Test", "version": "1.1.0", "description": "Test exporter"},
                {"id": "OpenTelemetry.Extensions.Test", "version": "1.2.0", "description": "Test extension"},
                {"id": "OpenTelemetry.Exporter.Deprecated", "version": "0.1.0", "deprecation": {"reasons": ["Legacy"]}},
                {"id": "OpenTelemetry.Contrib.Test", "version": "1.0.0", "description": "Contrib package"},
            ]
        }
        mock_get.side_effect = [mock_index_response, mock_search_response]

        result = client.fetch_instrumentation_list()
        assert "modules" in result
        # 3 valid ones, 1 deprecated, 1 contrib skipped
        assert len(result["modules"]) == 3

        types = [m["type"] for m in result["modules"]]
        assert "instrumentation" in types
        assert "exporter" in types
        assert "extension" in types

        # Sorted by name: Exporter.Test, Extensions.Test, Instrumentation.Test
        assert result["modules"][0]["name"] == "OpenTelemetry.Exporter.Test"
        assert result["modules"][0]["version"] == "1.1.0"
        assert result["modules"][2]["name"] == "OpenTelemetry.Instrumentation.Test"
        assert result["modules"][2]["version"] == "1.0.0"
