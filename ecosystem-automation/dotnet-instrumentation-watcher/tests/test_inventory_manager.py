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
import os
import tempfile

import pytest
from dotnet_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create mock workspace
        registry_dir = os.path.join(temp_dir, "ecosystem-registry", "dotnet")
        os.makedirs(registry_dir)
        yield temp_dir


def test_has_version(temp_workspace):
    manager = InventoryManager(inventory_dir=temp_workspace)
    assert manager.version_exists(Version("1.0.0")) is False


def test_save_and_list_versions(temp_workspace):
    manager = InventoryManager(inventory_dir=temp_workspace)

    mock_data = {"modules": [{"name": "test"}]}
    manager.save_versioned_inventory(Version("1.0.0"), mock_data)

    assert manager.version_exists(Version("1.0.0")) is True
    versions = manager.list_versions()
    assert Version("1.0.0") in versions


def test_cleanup_snapshots(temp_workspace):
    manager = InventoryManager(inventory_dir=temp_workspace)

    mock_data = {"modules": []}
    manager.save_versioned_inventory(Version("1.0.0-SNAPSHOT"), mock_data)
    manager.save_versioned_inventory(Version("1.0.1-SNAPSHOT"), mock_data)

    manager.cleanup_snapshots()
    assert not manager.version_exists(Version("1.0.0-SNAPSHOT"))
    assert not manager.version_exists(Version("1.0.1-SNAPSHOT"))
