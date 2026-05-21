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
from unittest.mock import patch

import pytest
from dotnet_instrumentation_watcher.main import main


@patch("dotnet_instrumentation_watcher.main.DotNetInstrumentationClient")
@patch("dotnet_instrumentation_watcher.main.InventoryManager")
@patch("dotnet_instrumentation_watcher.main.InstrumentationSync")
def test_main_success(mock_sync, mock_inventory, mock_client):
    mock_sync_instance = mock_sync.return_value
    mock_sync_instance.sync.return_value = {"new_release": "1.0.0", "snapshot_updated": "1.0.1-SNAPSHOT"}

    with patch("sys.argv", ["dotnet-instrumentation-watcher"]):
        assert main() is None


@patch("dotnet_instrumentation_watcher.main.DotNetInstrumentationClient")
@patch("dotnet_instrumentation_watcher.main.InventoryManager")
@patch("dotnet_instrumentation_watcher.main.InstrumentationSync")
def test_main_failure(mock_sync, mock_inventory, mock_client):
    mock_sync_instance = mock_sync.return_value
    mock_sync_instance.sync.side_effect = Exception("Test error")

    with patch("sys.argv", ["dotnet-instrumentation-watcher"]):
        with pytest.raises(SystemExit) as excinfo:
            main()
        assert excinfo.value.code == 1
