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
"""Tests for collector_builder module."""

import json
from unittest.mock import MagicMock

import pytest
from explorer_db_builder.collector_builder import (
    MINIMUM_VERSION,
    _get_merged_release_versions,
    run_collector_builder,
)
from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from semantic_version import Version


def _make_mock_inventory_manager(versions_by_distribution=None, inventories=None):
    manager = MagicMock()

    if versions_by_distribution is None:
        versions_by_distribution = {
            "core": [Version("0.151.0"), Version("0.150.0")],
            "contrib": [Version("0.151.0"), Version("0.150.0")],
        }

    manager.list_release_versions.side_effect = lambda dist: versions_by_distribution.get(dist, [])

    if inventories is None:
        inventories = {
            ("core", Version("0.151.0")): _make_core_inventory("0.151.0"),
            ("core", Version("0.150.0")): _make_core_inventory("0.150.0"),
            ("contrib", Version("0.151.0")): _make_contrib_inventory("0.151.0"),
            ("contrib", Version("0.150.0")): _make_contrib_inventory("0.150.0"),
        }

    manager.load_versioned_inventory.side_effect = lambda dist, ver: inventories.get(
        (dist, ver), {"distribution": dist, "version": str(ver), "repository": "", "components": {}}
    )

    return manager


def _make_core_inventory(version: str) -> dict:
    return {
        "distribution": "core",
        "version": version,
        "repository": "opentelemetry-collector",
        "components": {
            "receiver": [
                {
                    "name": "nopreceiver",
                    "metadata": {
                        "type": "nop",
                        "display_name": "No-op Receiver",
                        "status": {"stability": {"beta": ["traces"]}},
                    },
                }
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }


def _make_contrib_inventory(version: str) -> dict:
    return {
        "distribution": "contrib",
        "version": version,
        "repository": "opentelemetry-collector-contrib",
        "components": {
            "receiver": [
                {
                    "name": "otlpreceiver",
                    "metadata": {
                        "type": "otlp",
                        "display_name": "OTLP Receiver",
                        "status": {"stability": {"beta": ["traces"]}},
                    },
                },
                {
                    "name": "prometheusreceiver",
                    "metadata": {
                        "type": "prometheus",
                        "display_name": "Prometheus Receiver",
                        "status": {"stability": {"beta": ["metrics"]}},
                    },
                },
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }


class TestGetMergedReleaseVersions:
    def test_returns_union_sorted_newest_first(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.152.0"), Version("0.150.0")],
                "contrib": [Version("0.152.0"), Version("0.151.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [Version("0.152.0"), Version("0.151.0"), Version("0.150.0")]

    def test_raises_when_no_versions(self):
        manager = MagicMock()
        manager.list_release_versions.return_value = []
        with pytest.raises(ValueError, match="No release versions"):
            _get_merged_release_versions(manager)

    def test_deduplicates_shared_versions(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.150.0")],
                "contrib": [Version("0.150.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [Version("0.150.0")]

    def test_excludes_versions_below_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.151.0"), Version("0.150.0"), Version("0.100.0")],
                "contrib": [Version("0.151.0"), Version("0.99.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert all(v >= MINIMUM_VERSION for v in result)
        assert Version("0.100.0") not in result
        assert Version("0.99.0") not in result

    def test_raises_when_all_versions_below_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.99.0"), Version("0.50.0")],
                "contrib": [Version("0.99.0")],
            }
        )
        with pytest.raises(ValueError, match=str(MINIMUM_VERSION)):
            _get_merged_release_versions(manager)

    def test_includes_version_equal_to_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [MINIMUM_VERSION],
                "contrib": [MINIMUM_VERSION],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [MINIMUM_VERSION]


class TestRunCollectorBuilder:
    def test_success_creates_output_files(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        assert (tmp_path / "collector" / "versions-index.json").exists()
        assert (tmp_path / "collector" / "index.json").exists()
        assert (tmp_path / "collector" / "versions").exists()

    def test_versions_index_content(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "versions-index.json") as f:
            data = json.load(f)

        assert len(data["versions"]) == 2
        assert data["versions"][0]["version"] == "0.151.0"
        assert data["versions"][0]["is_latest"] is True

    def test_component_files_created(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        components_dir = tmp_path / "collector" / "components"
        assert components_dir.exists()
        component_dirs = list(components_dir.iterdir())
        # core: 1 receiver + contrib: 2 receivers = 3 total
        assert len(component_dirs) == 3

    def test_index_json_content(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "index.json") as f:
            data = json.load(f)

        assert data["ecosystem"] == "collector"
        assert sorted(data["taxonomy"]["distributions"]) == ["contrib", "core"]
        assert "receiver" in data["taxonomy"]["types"]
        assert len(data["components"]) == 3

    def test_clean_flag(self, tmp_path):
        manager = _make_mock_inventory_manager()
        out_dir = tmp_path / "collector"
        db_writer = CollectorDatabaseWriter(database_dir=str(out_dir))

        # First build
        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        # Create a stale file that should be removed on clean
        stale = out_dir / "stale.json"
        stale.write_text("{}")

        # Clean build using a fresh writer (simulating --clean)
        db_writer2 = CollectorDatabaseWriter(database_dir=str(out_dir))
        run_collector_builder(inventory_manager=manager, db_writer=db_writer2, clean=True)

        assert not stale.exists()

    def test_returns_1_on_no_versions(self, tmp_path):
        manager = MagicMock()
        manager.list_release_versions.return_value = []
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 1

    def test_versions_index_excludes_empty_versions(self, tmp_path):
        # 0.151.0 has components; 0.150.0 returns an empty inventory
        inventories = {
            ("core", Version("0.151.0")): _make_core_inventory("0.151.0"),
            ("contrib", Version("0.151.0")): _make_contrib_inventory("0.151.0"),
            ("core", Version("0.150.0")): {
                "distribution": "core",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.150.0")): {
                "distribution": "contrib",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        with open(tmp_path / "collector" / "versions-index.json") as f:
            data = json.load(f)

        versions_listed = [v["version"] for v in data["versions"]]
        assert versions_listed == ["0.151.0"]
        assert not (tmp_path / "collector" / "versions" / "0.150.0-index.json").exists()

    def test_returns_1_when_all_versions_empty(self, tmp_path):
        inventories = {
            ("core", Version("0.151.0")): {
                "distribution": "core",
                "version": "0.151.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.151.0")): {
                "distribution": "contrib",
                "version": "0.151.0",
                "repository": "",
                "components": {},
            },
            ("core", Version("0.150.0")): {
                "distribution": "core",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.150.0")): {
                "distribution": "contrib",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 1
