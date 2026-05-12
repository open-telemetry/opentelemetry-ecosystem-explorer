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
from unittest.mock import MagicMock

import pytest
from dotnet_instrumentation_watcher.instrumentation_sync import InstrumentationSync
from semantic_version import Version


@pytest.fixture
def mock_client():
    client = MagicMock()
    return client


@pytest.fixture
def mock_inventory():
    inventory = MagicMock()
    return inventory


def test_process_latest_release(mock_client, mock_inventory):
    mock_client.get_core_version.return_value = "1.2.3"
    mock_inventory.version_exists.return_value = False
    mock_client.fetch_instrumentation_list.return_value = {"modules": []}

    sync = InstrumentationSync(mock_client, mock_inventory)
    result = sync.process_latest_release()

    assert result == Version("1.2.3")
    mock_inventory.save_versioned_inventory.assert_called_once()


def test_process_latest_release_already_exists(mock_client, mock_inventory):
    mock_client.get_core_version.return_value = "1.2.3"
    mock_inventory.version_exists.return_value = True

    sync = InstrumentationSync(mock_client, mock_inventory)
    result = sync.process_latest_release()

    assert result is None
    mock_inventory.save_versioned_inventory.assert_not_called()


def test_update_snapshot(mock_client, mock_inventory):
    mock_client.get_core_version.return_value = "1.2.3"
    mock_client.fetch_instrumentation_list.return_value = {"modules": []}
    mock_inventory.cleanup_snapshots.return_value = 1

    sync = InstrumentationSync(mock_client, mock_inventory)
    result = sync.update_snapshot()

    assert result == Version("1.2.4-SNAPSHOT")
    mock_inventory.cleanup_snapshots.assert_called_once()
    mock_inventory.save_versioned_inventory.assert_called_once()
