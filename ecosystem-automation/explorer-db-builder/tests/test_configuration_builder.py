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
"""Tests for configuration builder."""

import json

import pytest
import yaml
from explorer_db_builder.configuration_builder import run_configuration_builder


@pytest.fixture
def config_registry(tmp_path):
    """Minimal configuration registry with one version."""
    version_dir = tmp_path / "registry" / "v1.0.0"
    version_dir.mkdir(parents=True)

    root_schema = {
        "type": "object",
        "properties": {
            "file_format": {"type": "string"},
            "propagator": {
                "$ref": "#/$defs/Propagator",
                "description": "Configure propagators.",
            },
        },
        "$defs": {
            "Propagator": {"$ref": "propagator.yaml"},
        },
    }
    propagator_schema = {
        "type": "object",
        "properties": {
            "composite": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
    }

    with open(version_dir / "opentelemetry_configuration.yaml", "w", encoding="utf-8") as f:
        yaml.dump(root_schema, f)
    with open(version_dir / "propagator.yaml", "w", encoding="utf-8") as f:
        yaml.dump(propagator_schema, f)

    return tmp_path / "registry"


@pytest.fixture
def output_dir(tmp_path):
    return tmp_path / "output"


class TestRunConfigurationBuilder:
    def test_produces_version_json(self, config_registry, output_dir):
        result = run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
        )

        assert result == 0

        version_file = output_dir / "versions" / "1.0.0.json"
        assert version_file.exists()

        data = json.loads(version_file.read_text())
        assert data["controlType"] == "group"
        assert data["key"] == "root"
        children_keys = [c["key"] for c in data["children"]]
        assert "file_format" in children_keys
        assert "propagator" in children_keys

    def test_produces_versions_index(self, config_registry, output_dir):
        run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
        )

        index_file = output_dir / "versions-index.json"
        assert index_file.exists()

        data = json.loads(index_file.read_text())
        assert len(data["versions"]) == 1
        assert data["versions"][0]["version"] == "1.0.0"
        assert data["versions"][0]["is_latest"] is True

    def test_filters_snapshot_versions(self, config_registry, output_dir):
        snapshot_dir = config_registry / "v1.0.1-SNAPSHOT"
        snapshot_dir.mkdir()
        root = {"type": "object", "properties": {}}
        with open(snapshot_dir / "opentelemetry_configuration.yaml", "w", encoding="utf-8") as f:
            yaml.dump(root, f)

        run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
        )

        index = json.loads((output_dir / "versions-index.json").read_text())
        versions = [v["version"] for v in index["versions"]]
        assert "1.0.0" in versions
        assert "1.0.1-SNAPSHOT" not in versions

    def test_no_release_versions(self, tmp_path):
        empty_registry = tmp_path / "empty_registry"
        empty_registry.mkdir()
        output = tmp_path / "output"

        result = run_configuration_builder(
            registry_dir=str(empty_registry),
            output_dir=str(output),
        )

        assert result == 1

    def test_multiple_versions_latest_flag(self, config_registry, output_dir):
        v2_dir = config_registry / "v2.0.0"
        v2_dir.mkdir()
        root = {"type": "object", "properties": {"x": {"type": "string"}}}
        with open(v2_dir / "opentelemetry_configuration.yaml", "w", encoding="utf-8") as f:
            yaml.dump(root, f)

        run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
        )

        index = json.loads((output_dir / "versions-index.json").read_text())
        for entry in index["versions"]:
            if entry["version"] == "2.0.0":
                assert entry["is_latest"] is True
            else:
                assert entry["is_latest"] is False

    def test_clean_removes_output_dir(self, config_registry, output_dir):
        run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
        )
        stale_file = output_dir / "versions" / "0.9.0.json"
        stale_file.write_text("{}")

        run_configuration_builder(
            registry_dir=str(config_registry),
            output_dir=str(output_dir),
            clean=True,
        )

        assert not stale_file.exists()
        assert (output_dir / "versions" / "1.0.0.json").exists()
