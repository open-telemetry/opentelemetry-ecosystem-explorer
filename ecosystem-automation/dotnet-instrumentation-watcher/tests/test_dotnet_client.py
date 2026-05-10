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
from dotnet_instrumentation_watcher.dotnet_client import DotNetInstrumentationClient, GithubAPIError


def test_get_latest_release_tag_success():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = {"tag_name": "v1.2.3"}
        mock_get.return_value = mock_response

        tag = client.get_latest_release_tag()
        assert tag == "v1.2.3"


def test_get_latest_release_tag_error():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        from requests import RequestException

        mock_get.side_effect = RequestException("API error")
        with pytest.raises(GithubAPIError):
            client.get_latest_release_tag()


def test_fetch_instrumentation_list():
    client = DotNetInstrumentationClient()
    with patch.object(client._session, "get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "tree": [
                {"path": "src/OpenTelemetry.Instrumentation.Test/OpenTelemetry.Instrumentation.Test.csproj"},
                {"path": "src/OpenTelemetry.Exporter.Test/OpenTelemetry.Exporter.Test.csproj"},
                {"path": "src/OpenTelemetry.Extensions.Test/OpenTelemetry.Extensions.Test.csproj"},
            ]
        }
        mock_get.return_value = mock_response

        result = client.fetch_instrumentation_list()
        assert "modules" in result
        assert len(result["modules"]) == 3

        types = [m["type"] for m in result["modules"]]
        assert "instrumentation" in types
        assert "exporter" in types
        assert "extension" in types
