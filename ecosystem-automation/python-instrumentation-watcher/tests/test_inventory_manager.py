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
from python_instrumentation_watcher.inventory_manager import InventoryManager


def test_save_and_version_exists(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {"name": "opentelemetry-instrumentation-flask", "version": "0.48b0"}

    assert not manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    assert manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")


def test_save_writes_valid_yaml(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {
        "name": "opentelemetry-instrumentation-flask",
        "version": "0.48b0",
        "instruments": [{"library": "flask", "version_range": ">=1.0", "source_key": "instruments"}],
    }

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    path = tmp_path / "opentelemetry-instrumentation-flask" / "v0.48b0.yaml"
    assert path.exists()

    loaded = yaml.safe_load(path.read_text())
    assert loaded["name"] == "opentelemetry-instrumentation-flask"
    assert loaded["instruments"][0]["library"] == "flask"


def test_version_path_format(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    manager.save("opentelemetry-instrumentation-requests", "0.48b0", {"name": "test"})

    expected = tmp_path / "opentelemetry-instrumentation-requests" / "v0.48b0.yaml"
    assert expected.exists()
