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
from prometheus_watcher.inventory_manager import InventoryManager
from semantic_version import Version


def test_list_release_versions(tmp_path):
    # Setup mock registry
    official_dir = tmp_path / "official"
    official_dir.mkdir()
    (official_dir / "v1.0.0").mkdir()
    (official_dir / "v1.1.0-alpha").mkdir()
    (official_dir / "v1.2.0").mkdir()

    manager = InventoryManager(inventory_dir=str(tmp_path))
    versions = manager.list_release_versions("official")

    assert versions == [Version("1.2.0"), Version("1.0.0")]


def test_load_versioned_inventory(tmp_path):
    # Setup mock registry
    v1_dir = tmp_path / "official" / "v1.0.0"
    v1_dir.mkdir(parents=True)

    exporter_yaml = v1_dir / "exporter.yaml"
    exporter_yaml.write_text("""
component_type: exporter
components:
  - name: test_exporter
    metadata:
      display_name: Test Exporter
""")

    manager = InventoryManager(inventory_dir=str(tmp_path))
    inventory = manager.load_versioned_inventory("official", Version("1.0.0"))

    assert inventory["distribution"] == "official"
    assert inventory["version"] == "1.0.0"
    assert "exporter" in inventory["components"]
    assert inventory["components"]["exporter"][0]["name"] == "test_exporter"
