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

"""Tests for InventoryManager."""

import yaml
from js_instrumentation_watcher.inventory_manager import InventoryManager


def test_save_and_version_exists(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {"name": "instrumentation-express", "version": "0.66.0"}

    assert not manager.version_exists("instrumentation-express", "0.66.0")

    manager.save("instrumentation-express", "0.66.0", data)

    assert manager.version_exists("instrumentation-express", "0.66.0")


def test_save_writes_valid_yaml(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {
        "name": "instrumentation-express",
        "version": "0.66.0",
        "npm_package": "@opentelemetry/instrumentation-express",
    }

    manager.save("instrumentation-express", "0.66.0", data)

    path = tmp_path / "instrumentation-express" / "v0.66.0.yaml"
    assert path.exists()

    loaded = yaml.safe_load(path.read_text())
    assert loaded["name"] == "instrumentation-express"
    assert loaded["npm_package"] == "@opentelemetry/instrumentation-express"


def test_version_path_format(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    manager.save("instrumentation-mongoose", "0.64.0", {"name": "test"})

    expected = tmp_path / "instrumentation-mongoose" / "v0.64.0.yaml"
    assert expected.exists()
