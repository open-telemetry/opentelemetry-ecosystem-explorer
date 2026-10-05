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
"""Build real registries to exercise raw-name indexes through published output."""

import json

import pytest
from collector_watcher.inventory_manager import InventoryManager
from explorer_db_builder.collector_builder import run_collector_builder
from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from explorer_db_builder.database_writer import DatabaseWriter
from explorer_db_builder.main import run_javaagent_builder
from semantic_version import Version
from watcher_common.inventory_manager import JavaagentInventoryManager
from watcher_common.readme_store import readme_filename


@pytest.mark.parametrize("ecosystem", ["java", "collector"])
def test_real_manager_build_publishes_readme_and_hash(tmp_path, ecosystem):
    registry, output = tmp_path / "registry", tmp_path / "output"
    version = Version("1.0.0")
    name, content = "raw/name", "# Library\n\nUseful documentation.\n"
    filename = readme_filename(name, content)
    digest = filename[-15:-3]
    if ecosystem == "java":
        manager = JavaagentInventoryManager(str(registry))
        manager.save_versioned_inventory(version, {"file_format": 0.5, "libraries": [{"name": name}]})
        manager.save_library_readmes(version, [(name, content)])
        assert run_javaagent_builder(manager, DatabaseWriter(str(output)), clean=True) == 0
    else:
        manager = InventoryManager(str(registry))
        manager.save_versioned_inventory(
            "core",
            version,
            {"receiver": [{"name": name, "metadata": {"display_name": "Raw Name"}}]},
            "opentelemetry-collector",
        )
        manager.save_component_readmes("core", version, [(name, content)])
        assert run_collector_builder(manager, CollectorDatabaseWriter(str(output)), clean=True) == 0
    assert (output / "markdown" / filename).read_text() == content
    records = [json.loads(path.read_text()) for path in output.rglob("*.json")]
    assert any(
        isinstance(record, dict) and record.get("name") == name and record.get("markdown_hash") == digest
        for record in records
    )
