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
"""Tests for the otelc builder."""

import json
import logging
from pathlib import Path

import pytest
import yaml
from explorer_db_builder.content_hashing import content_hash
from explorer_db_builder.otelc_builder import (
    GoInventoryManager,
    _parse_min_v,
    run_otelc_builder,
)
from semantic_version import Version


class TestParseMinV:
    """Test _parse_min_v edge cases and fallback logic."""

    def test_empty_string(self):
        assert _parse_min_v("") == Version("0.0.0")

    def test_two_segment_version(self):
        assert _parse_min_v("1.22") == Version("1.22.0")

    def test_two_segment_with_v_prefix(self):
        assert _parse_min_v("v1.22") == Version("1.22.0")

    def test_three_segment_version(self):
        assert _parse_min_v("1.22.3") == Version("1.22.3")

    def test_three_segment_with_v_prefix(self):
        assert _parse_min_v("v0.1.0") == Version("0.1.0")

    def test_unparseable_string_warns_and_defaults(self, caplog):
        with caplog.at_level(logging.WARNING):
            result = _parse_min_v("latest")
        assert result == Version("0.0.0")
        assert "Unparseable version string: 'latest'" in caplog.text


@pytest.fixture
def mock_go_registry(tmp_path: Path) -> Path:
    """Creates a mock Go ecosystem registry with multiple repos and versions."""
    registry_dir = tmp_path / "ecosystem-registry"
    go_dir = registry_dir / "go"

    # Repo 1: opentelemetry-go-compile-instrumentation
    repo1_dir = go_dir / "opentelemetry-go-compile-instrumentation"

    # v0.3.0: Has 1 automatic and 1 manual instrumentation
    v030 = repo1_dir / "v0.3.0"
    v030.mkdir(parents=True)
    v030_data = {
        "file_format": 0.1,
        "libraries": [
            {
                "name": "instrumentation-net-http-otelhttp",
                "display_name": "net/http",
                "description": "Instrumentation for net/http",
                "target_module": "net/http",
                "modules": [
                    {"path": "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp", "version": "v0.60.0"}
                ],
                "go_min_version": "1.22",
                "otelc_min_version": "v0.2.0",
                "stability": "stable",
                "extra_field_to_strip": "ignored_value",
                "installation": {
                    "methods": ["automatic", "wrapper"],
                },
            },
            {
                "name": "manual-only-lib",
                "display_name": "Manual Only",
                "description": "Manual only instrumentation",
                "installation": {
                    "methods": ["wrapper"],
                },
            },
        ],
    }
    with open(v030 / "instrumentation.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(v030_data, f)

    # v0.2.0: Has 1 automatic instrumentation
    v020 = repo1_dir / "v0.2.0"
    v020.mkdir(parents=True)
    v020_data = {
        "file_format": 0.1,
        "libraries": [
            {
                "name": "instrumentation-net-http-otelhttp",
                "display_name": "net/http",
                "description": "Instrumentation for net/http",
                "target_module": "net/http",
                "modules": [
                    {"path": "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp", "version": "v0.59.0"}
                ],
                "go_min_version": "1.21",
                "otelc_min_version": "v0.1.0",
                "stability": "stable",
                "installation": {
                    "methods": ["automatic"],
                },
            }
        ],
    }
    with open(v020 / "instrumentation.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(v020_data, f)

    # v0.4.0-SNAPSHOT: Should be excluded
    v_snap = repo1_dir / "v0.4.0-SNAPSHOT"
    v_snap.mkdir(parents=True)
    with open(v_snap / "instrumentation.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(v030_data, f)

    # Repo 2: manual-only-repo (should be omitted from catalog)
    repo2_dir = go_dir / "manual-only-repo"
    repo2_v1 = repo2_dir / "v1.0.0"
    repo2_v1.mkdir(parents=True)
    repo2_data = {
        "file_format": 0.1,
        "libraries": [
            {
                "name": "manual-lib",
                "installation": {"methods": ["wrapper"]},
            }
        ],
    }
    with open(repo2_v1 / "instrumentation.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(repo2_data, f)

    return registry_dir


class TestGoInventoryManager:
    """Test GoInventoryManager methods."""

    def test_load_nonexistent_inventory(self, tmp_path):
        mgr = GoInventoryManager(str(tmp_path))
        assert mgr.load_versioned_inventory(Version("1.0.0")) == {}

    def test_load_malformed_yaml(self, tmp_path, caplog):
        v_dir = tmp_path / "v1.0.0"
        v_dir.mkdir(parents=True)
        (v_dir / "instrumentation.yaml").write_text(": : : invalid yaml", encoding="utf-8")
        mgr = GoInventoryManager(str(tmp_path))
        with caplog.at_level(logging.WARNING):
            data = mgr.load_versioned_inventory(Version("1.0.0"))
        assert data == {}
        assert "Failed to load inventory" in caplog.text

    def test_load_non_dict_yaml(self, tmp_path, caplog):
        v_dir = tmp_path / "v1.0.0"
        v_dir.mkdir(parents=True)
        (v_dir / "instrumentation.yaml").write_text("- item1\n- item2\n", encoding="utf-8")
        mgr = GoInventoryManager(str(tmp_path))
        with caplog.at_level(logging.WARNING):
            data = mgr.load_versioned_inventory(Version("1.0.0"))
        assert data == {}
        assert "not a valid YAML mapping" in caplog.text


class TestRunOtelcBuilder:
    """Test end-to-end execution of run_otelc_builder."""

    def test_happy_path(self, mock_go_registry: Path, tmp_path: Path):
        output_dir = tmp_path / "public" / "data"
        result = run_otelc_builder(
            registry_dir=str(mock_go_registry),
            output_dir=str(output_dir),
        )
        assert result == 0

        v1_dir = output_dir / "otelc" / "v1"
        catalog_path = v1_dir / "catalog.json"
        assert catalog_path.exists()

        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        assert catalog["schema_version"] == 1
        assert len(catalog["repositories"]) == 1

        repo = catalog["repositories"][0]
        assert repo["name"] == "opentelemetry-go-compile-instrumentation"
        assert len(repo["releases"]) == 2

        # Sorted newest-to-oldest
        rel_030 = repo["releases"][0]
        assert rel_030["version"] == "vv0.3.0" or rel_030["version"] == "v0.3.0"
        assert rel_030["is_latest"] is True
        assert rel_030["min_go_version"] == "1.22"
        assert rel_030["min_otelc_version"] == "v0.2.0"

        rel_020 = repo["releases"][1]
        assert rel_020["is_latest"] is False
        assert rel_020["min_go_version"] == "1.21"
        assert rel_020["min_otelc_version"] == "v0.1.0"

        # Verify registry files
        releases_dir = v1_dir / "releases"
        assert releases_dir.exists()

        hash_030 = rel_030["registry_hash"]
        reg_file_030 = releases_dir / f"registry-{hash_030}.json"
        assert reg_file_030.exists()

        reg_data_030 = json.loads(reg_file_030.read_text(encoding="utf-8"))
        assert reg_data_030["schema_version"] == 1
        assert reg_data_030["registry_hash"] == hash_030
        assert len(reg_data_030["instrumentations"]) == 1

        lib = reg_data_030["instrumentations"][0]
        assert lib["name"] == "instrumentation-net-http-otelhttp"
        assert lib["display_name"] == "net/http"
        assert lib["target_module"] == "net/http"
        assert "extra_field_to_strip" not in lib
        assert "installation" not in lib

    def test_hash_computation_and_reverification(self, mock_go_registry: Path, tmp_path: Path):
        output_dir = tmp_path / "public" / "data"
        run_otelc_builder(
            registry_dir=str(mock_go_registry),
            output_dir=str(output_dir),
        )

        catalog_path = output_dir / "otelc" / "v1" / "catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        rel = catalog["repositories"][0]["releases"][0]
        expected_hash = rel["registry_hash"]

        reg_file = output_dir / "otelc" / "v1" / "releases" / f"registry-{expected_hash}.json"
        payload = json.loads(reg_file.read_text(encoding="utf-8"))

        # Re-verification algorithm as specified in docs/otelc-registry.md
        payload_for_verification = {k: v for k, v in payload.items() if k != "registry_hash"}
        computed_hash = content_hash(payload_for_verification)

        assert computed_hash == expected_hash

    def test_hash_stability_and_deduplication(self, tmp_path: Path):
        registry_dir = tmp_path / "ecosystem-registry"
        repo_dir = registry_dir / "go" / "my-repo"

        # Two versions with identical automatic instrumentations
        for v in ("v1.0.0", "v1.0.1"):
            v_dir = repo_dir / v
            v_dir.mkdir(parents=True)
            data = {
                "file_format": 0.1,
                "libraries": [
                    {
                        "name": "same-lib",
                        "installation": {"methods": ["automatic"]},
                    }
                ],
            }
            with open(v_dir / "instrumentation.yaml", "w", encoding="utf-8") as f:
                yaml.safe_dump(data, f)

        output_dir = tmp_path / "public" / "data"
        run_otelc_builder(registry_dir=str(registry_dir), output_dir=str(output_dir))

        catalog = json.loads((output_dir / "otelc" / "v1" / "catalog.json").read_text(encoding="utf-8"))
        releases = catalog["repositories"][0]["releases"]
        assert len(releases) == 2
        assert releases[0]["registry_hash"] == releases[1]["registry_hash"]

        # Only one registry file should exist
        written_files = list((output_dir / "otelc" / "v1" / "releases").glob("*.json"))
        assert len(written_files) == 1

    def test_no_go_base_directory(self, tmp_path: Path, caplog):
        with caplog.at_level(logging.WARNING):
            result = run_otelc_builder(
                registry_dir=str(tmp_path / "nonexistent"),
                output_dir=str(tmp_path / "output"),
            )
        assert result == 0
        assert "No Go registry found" in caplog.text

    def test_no_automatic_instrumentations_across_all_repos(self, tmp_path: Path, caplog):
        repo_dir = tmp_path / "registry" / "go" / "manual-repo" / "v1.0.0"
        repo_dir.mkdir(parents=True)
        with open(repo_dir / "instrumentation.yaml", "w", encoding="utf-8") as f:
            yaml.safe_dump({"libraries": [{"name": "m", "installation": {"methods": ["manual"]}}]}, f)

        with caplog.at_level(logging.WARNING):
            result = run_otelc_builder(
                registry_dir=str(tmp_path / "registry"),
                output_dir=str(tmp_path / "output"),
            )
        assert result == 0
        assert "No Go repositories generated automatic instrumentations" in caplog.text

    def test_clean_flag_removes_old_artifacts(self, mock_go_registry: Path, tmp_path: Path):
        output_dir = tmp_path / "public" / "data"
        run_otelc_builder(registry_dir=str(mock_go_registry), output_dir=str(output_dir))

        dummy_file = output_dir / "otelc" / "v1" / "releases" / "dummy_old.json"
        dummy_file.write_text("old data", encoding="utf-8")
        assert dummy_file.exists()

        run_otelc_builder(
            registry_dir=str(mock_go_registry),
            output_dir=str(output_dir),
            clean=True,
        )
        assert not dummy_file.exists()

    def test_corrupted_version_skipped_gracefully(self, tmp_path: Path, caplog):
        repo_dir = tmp_path / "registry" / "go" / "partially-broken-repo"

        # Broken version v1.0.0
        v1_dir = repo_dir / "v1.0.0"
        v1_dir.mkdir(parents=True)
        (v1_dir / "instrumentation.yaml").write_text(": : invalid", encoding="utf-8")

        # Working version v2.0.0
        v2_dir = repo_dir / "v2.0.0"
        v2_dir.mkdir(parents=True)
        with open(v2_dir / "instrumentation.yaml", "w", encoding="utf-8") as f:
            yaml.safe_dump(
                {
                    "libraries": [
                        {
                            "name": "good-lib",
                            "installation": {"methods": ["automatic"]},
                        }
                    ]
                },
                f,
            )

        output_dir = tmp_path / "output"
        result = run_otelc_builder(registry_dir=str(tmp_path / "registry"), output_dir=str(output_dir))
        assert result == 0

        catalog = json.loads((output_dir / "otelc" / "v1" / "catalog.json").read_text(encoding="utf-8"))
        repo = catalog["repositories"][0]
        # Only v2.0.0 should be present
        assert len(repo["releases"]) == 1
        assert repo["releases"][0]["version"] == "v2.0.0"
