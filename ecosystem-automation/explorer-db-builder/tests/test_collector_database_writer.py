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
"""Tests for collector_database_writer module."""

import json
import logging

import pytest
from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from semantic_version import Version


@pytest.fixture
def temp_db_dir(tmp_path):
    return tmp_path / "collector_db"


@pytest.fixture
def db_writer(temp_db_dir):
    return CollectorDatabaseWriter(database_dir=str(temp_db_dir))


@pytest.fixture
def sample_components():
    return [
        {
            "id": "contrib-otlp",
            "ecosystem": "collector",
            "distribution": "contrib",
            "type": "receiver",
            "name": "otlpreceiver",
            "display_name": "OTLP Receiver",
            "description": "Receives OTLP data.",
            "repository": "opentelemetry-collector-contrib",
            "status": {"class": "receiver", "stability": {"beta": ["traces"]}},
        },
        {
            "id": "core-batch",
            "ecosystem": "collector",
            "distribution": "core",
            "type": "processor",
            "name": "batchprocessor",
            "display_name": "Batch Processor",
            "description": None,
            "repository": "opentelemetry-collector",
            "status": {"class": "processor", "stability": {"beta": ["traces", "metrics", "logs"]}},
        },
    ]


class TestWriteComponents:
    def test_write_components_success(self, db_writer, sample_components, temp_db_dir):
        component_map = db_writer.write_components(sample_components)

        assert len(component_map) == 2
        assert "contrib-otlp" in component_map
        assert "core-batch" in component_map
        assert len(component_map["contrib-otlp"]) == 12

        for comp_id, comp_hash in component_map.items():
            expected = temp_db_dir / "components" / comp_id / f"{comp_id}-{comp_hash}.json"
            assert expected.exists()

    def test_write_components_content(self, db_writer, sample_components, temp_db_dir):
        component_map = db_writer.write_components(sample_components)

        comp_id = "contrib-otlp"
        comp_hash = component_map[comp_id]
        path = temp_db_dir / "components" / comp_id / f"{comp_id}-{comp_hash}.json"
        with open(path) as f:
            data = json.load(f)

        assert data["id"] == comp_id
        assert data["display_name"] == "OTLP Receiver"

    def test_write_components_empty_list(self, db_writer):
        with pytest.raises(ValueError, match="Components list cannot be empty"):
            db_writer.write_components([])

    def test_write_components_no_id(self, db_writer, caplog):
        components = [
            {"ecosystem": "collector", "distribution": "contrib", "type": "receiver"},
            {"id": "valid-id", "ecosystem": "collector"},
        ]
        component_map = db_writer.write_components(components)

        assert len(component_map) == 1
        assert "valid-id" in component_map

    def test_write_components_dedup(self, db_writer, caplog):
        caplog.set_level(logging.DEBUG)
        components = [{"id": "same-id", "value": 1}]

        map1 = db_writer.write_components(components)
        files_after_first = db_writer.files_written

        caplog.clear()
        map2 = db_writer.write_components(components)

        assert map1["same-id"] == map2["same-id"]
        assert db_writer.files_written == files_after_first
        assert "already exists" in caplog.text

    def test_write_components_different_content_different_hash(self, db_writer):
        map1 = db_writer.write_components([{"id": "myid", "value": 1}])
        map2 = db_writer.write_components([{"id": "myid", "value": 2}])
        assert map1["myid"] != map2["myid"]

    def test_write_components_all_invalid(self, db_writer):
        with pytest.raises(ValueError, match="No valid components were processed"):
            db_writer.write_components(["not-a-dict", {"no_id": True}])


class TestWriteVersionIndex:
    def test_write_version_index_success(self, db_writer, temp_db_dir):
        version = Version("0.150.0")
        component_map = {"contrib-otlp": "abc123456789"}

        db_writer.write_version_index(version, component_map)

        version_file = temp_db_dir / "versions" / "0.150.0-index.json"
        assert version_file.exists()

        with open(version_file) as f:
            data = json.load(f)

        assert data["version"] == "0.150.0"
        assert data["components"] == component_map

    def test_write_version_index_creates_directory(self, db_writer, temp_db_dir):
        assert not (temp_db_dir / "versions").exists()
        db_writer.write_version_index(Version("0.150.0"), {"id": "hash"})
        assert (temp_db_dir / "versions").exists()

    def test_write_version_index_empty_map(self, db_writer):
        with pytest.raises(ValueError, match="Component map cannot be empty"):
            db_writer.write_version_index(Version("0.150.0"), {})


class TestWriteVersionList:
    def test_write_version_list_success(self, db_writer, temp_db_dir):
        versions = [Version("0.150.0"), Version("0.149.0"), Version("0.148.0")]
        db_writer.write_version_list(versions)

        path = temp_db_dir / "versions-index.json"
        assert path.exists()
        with open(path) as f:
            data = json.load(f)

        assert len(data["versions"]) == 3
        assert data["versions"][0]["version"] == "0.150.0"
        assert data["versions"][0]["is_latest"] is True
        assert data["versions"][1]["is_latest"] is False
        assert data["versions"][2]["is_latest"] is False

    def test_write_version_list_empty(self, db_writer):
        with pytest.raises(ValueError, match="Versions list cannot be empty"):
            db_writer.write_version_list([])


class TestWriteIndex:
    def test_write_index_success(self, db_writer, sample_components, temp_db_dir):
        db_writer.write_index(sample_components)

        index_file = temp_db_dir / "index.json"
        assert index_file.exists()

        with open(index_file) as f:
            data = json.load(f)

        assert data["ecosystem"] == "collector"
        assert "taxonomy" in data
        assert "components" in data

    def test_write_index_taxonomy(self, db_writer, sample_components, temp_db_dir):
        db_writer.write_index(sample_components)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        taxonomy = data["taxonomy"]
        assert sorted(taxonomy["distributions"]) == ["contrib", "core"]
        # types ordered by canonical order (connector, exporter, extension, processor, receiver)
        assert "processor" in taxonomy["types"]
        assert "receiver" in taxonomy["types"]
        assert taxonomy["types"].index("processor") < taxonomy["types"].index("receiver")

    def test_write_index_lightweight_components(self, db_writer, sample_components, temp_db_dir):
        db_writer.write_index(sample_components)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        index_components = data["components"]
        assert len(index_components) == 2

        otlp = next(c for c in index_components if c["id"] == "contrib-otlp")
        assert otlp["display_name"] == "OTLP Receiver"
        assert otlp["stability"] == "beta"
        # heavy fields absent
        assert "repository" not in otlp
        assert "attributes" not in otlp


class TestGetStats:
    def test_initial_stats(self, db_writer):
        stats = db_writer.get_stats()
        assert stats["files_written"] == 0
        assert stats["total_bytes"] == 0

    def test_stats_after_writing(self, db_writer, sample_components):
        db_writer.write_components(sample_components)
        stats = db_writer.get_stats()
        assert stats["files_written"] == 2
        assert stats["total_bytes"] > 0


class TestClean:
    def test_clean_removes_directory(self, db_writer, temp_db_dir):
        temp_db_dir.mkdir(parents=True)
        (temp_db_dir / "something.json").write_text("{}")

        db_writer.clean()

        assert temp_db_dir.exists()
        assert not (temp_db_dir / "something.json").exists()

    def test_clean_creates_directory(self, db_writer, temp_db_dir):
        assert not temp_db_dir.exists()
        db_writer.clean()
        assert temp_db_dir.exists()


class TestIntegration:
    def test_full_workflow(self, db_writer, sample_components, temp_db_dir):
        component_map = db_writer.write_components(sample_components)

        version = Version("0.150.0")
        db_writer.write_version_index(version, component_map)
        db_writer.write_version_list([version])
        db_writer.write_index(sample_components)

        assert (temp_db_dir / "versions-index.json").exists()
        assert (temp_db_dir / "versions" / "0.150.0-index.json").exists()
        assert (temp_db_dir / "index.json").exists()

        for comp_id, comp_hash in component_map.items():
            assert (temp_db_dir / "components" / comp_id / f"{comp_id}-{comp_hash}.json").exists()
