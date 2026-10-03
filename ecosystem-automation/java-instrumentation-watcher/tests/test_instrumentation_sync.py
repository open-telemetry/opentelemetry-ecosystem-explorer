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
"""Tests for instrumentation sync orchestrator."""

import tempfile
from unittest.mock import Mock

import pytest
import yaml
from java_instrumentation_watcher.instrumentation_sync import InstrumentationSync
from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


class TestInstrumentationSync:
    @pytest.fixture
    def temp_inventory_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def inventory_manager(self, temp_inventory_dir):
        return InventoryManager(inventory_dir=temp_inventory_dir)

    @pytest.fixture
    def mock_client(self):
        return Mock()

    @pytest.fixture
    def mock_readme_extractor(self):
        extractor = Mock()
        extractor.discover_library_readmes.return_value = {}
        return extractor

    @pytest.fixture
    def mock_jmx_model_extractor(self):
        extractor = Mock()
        extractor.discover_jmx_model_paths.return_value = ({}, None)
        return extractor

    @pytest.fixture
    def sync(self, mock_client, inventory_manager, mock_readme_extractor, mock_jmx_model_extractor):
        return InstrumentationSync(
            mock_client,
            inventory_manager,
            readme_extractor=mock_readme_extractor,
            jmx_model_extractor=mock_jmx_model_extractor,
        )

    def test_process_latest_release_new_version(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: test
    name: Test Instrumentation
"""

        version = sync.process_latest_release()

        assert version == Version("2.10.0")
        mock_client.get_latest_release_tag.assert_called_once()
        mock_client.fetch_instrumentation_list.assert_called_once_with(ref="v2.10.0")

        assert sync.inventory_manager.version_exists(Version("2.10.0"))

    def test_process_latest_release_existing_version(self, sync, mock_client, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.1, "libraries": {}},
        )
        inventory_manager.record_readme_sync(version, {})
        inventory_manager.save_jmx_models_index(version, models={"jvm": "metrics: []\n"}, manifest=None)

        mock_client.get_latest_release_tag.return_value = "v2.10.0"

        result = sync.process_latest_release()

        assert result is None
        mock_client.fetch_instrumentation_list.assert_not_called()

    def test_update_snapshot(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: snapshot-test
    name: Snapshot Test
"""

        snapshot_version = sync.update_snapshot()

        assert snapshot_version == Version("2.10.1-SNAPSHOT")
        mock_client.resolve_ref_to_sha.assert_any_call("main")
        mock_client.fetch_instrumentation_list.assert_called_once_with(ref="sha123")

        # Verify saved to inventory
        assert sync.inventory_manager.version_exists(Version("2.10.1-SNAPSHOT"))

    def test_update_snapshot_cleans_old_snapshots(self, sync, mock_client, inventory_manager):
        old_snapshot = Version("2.9.0-SNAPSHOT")
        inventory_manager.save_versioned_inventory(
            version=old_snapshot,
            instrumentations={"file_format": 0.1, "libraries": {}},
        )

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: test
"""

        snapshot_version = sync.update_snapshot()

        # Old snapshot should be removed
        assert not inventory_manager.version_exists(old_snapshot)
        # New snapshot should exist
        assert inventory_manager.version_exists(snapshot_version)

    def test_sync_full_workflow(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_instrumentation_list.side_effect = [
            """
instrumentations:
  - id: release-test
    name: Release Test
""",
            # Second call for snapshot
            """
instrumentations:
  - id: snapshot-test
    name: Snapshot Test
""",
        ]

        summary = sync.sync()

        assert summary["new_release"] == "2.10.0"
        assert summary["snapshot_updated"] == "2.10.1-SNAPSHOT"

        # Verify both versions saved
        assert sync.inventory_manager.version_exists(Version("2.10.0"))
        assert sync.inventory_manager.version_exists(Version("2.10.1-SNAPSHOT"))

    def test_sync_no_new_release(self, sync, mock_client, inventory_manager):
        inventory_manager.save_versioned_inventory(
            version=Version("2.10.0"),
            instrumentations={"file_format": 0.1, "libraries": {}},
        )
        # Seed sync state so backfill doesn't trigger
        inventory_manager.record_readme_sync(Version("2.10.0"), {})

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: snapshot-test
"""

        summary = sync.sync()

        # Should indicate no new release
        assert summary["new_release"] is None
        # But snapshot should still be updated
        assert summary["snapshot_updated"] == "2.10.1-SNAPSHOT"

    def test_version_with_v_prefix_handling(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: test
"""

        version = sync.process_latest_release()

        # Version should not have 'v' prefix
        assert str(version) == "2.10.0"
        assert version == Version("2.10.0")

    def test_update_snapshot_with_yaml_error(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = "malformed: [yaml"

        with pytest.raises(ValueError, match="Error parsing instrumentation YAML"):
            sync.update_snapshot()

    def test_update_snapshot_parse_failure_preserves_existing_snapshot(self, sync, mock_client, inventory_manager):
        existing = Version("2.9.1-SNAPSHOT")
        inventory_manager.save_versioned_inventory(
            version=existing,
            instrumentations={"file_format": 0.1, "libraries": []},
        )

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = "malformed: [yaml"

        with pytest.raises(ValueError):
            sync.update_snapshot()

        assert inventory_manager.version_exists(existing)

    def test_parse_cleans_whitespace(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = """
file_format: 0.1
libraries:
  test:
  - name: '  Test Name  '
    description: 'Description with trailing spaces.

        '
"""

        version = sync.process_latest_release()

        assert version == Version("2.10.0")

        # Load and check that strings were cleaned and library structure flattened
        loaded = sync.inventory_manager.load_versioned_inventory(version)
        assert isinstance(loaded["libraries"], list)
        test_lib = loaded["libraries"][0]
        assert test_lib["name"] == "Test Name"
        assert test_lib["description"] == "Description with trailing spaces."
        assert test_lib["tags"] == ["test"]

    # --- _sync_library_readmes ---

    _YAML_WITH_LIBRARIES = """
file_format: 0.5
libraries:
  instrumentation:
  - name: akka-actor-2.3
    source_path: instrumentation/akka/akka-actor-2.3
  - name: apache-httpclient-4.3
    source_path: instrumentation/apache-httpclient/apache-httpclient-4.3
"""

    _TREE = [
        {"type": "blob", "path": "instrumentation/akka/akka-actor-2.3/library/README.md"},
        {"type": "blob", "path": "instrumentation/apache-httpclient/apache-httpclient-4.3/library/README.md"},
    ]

    def test_release_sync_writes_readmes(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE
        mock_client.fetch_raw_file.return_value = "# README"

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        version = sync.process_latest_release()

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert global_readme_dir.exists()
        assert len(list(global_readme_dir.glob("*.md"))) == 2

        # instrumentation.yaml should have readme fields
        loaded = inventory_manager.load_versioned_inventory(version)
        libraries_raw = loaded.get("libraries", [])
        if isinstance(libraries_raw, dict):
            libs = [lib for group in libraries_raw.values() for lib in group]
        else:
            libs = libraries_raw
        assert all(lib.get("readme") for lib in libs)
        assert inventory_manager.readmes_synced(version)

    def test_snapshot_sync_writes_readmes(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE
        mock_client.fetch_raw_file.return_value = "# README"

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        snapshot_version = sync.update_snapshot()

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert global_readme_dir.exists()
        assert not inventory_manager.jmx_models_index_exists(snapshot_version)
        mock_jmx_model_extractor.discover_jmx_model_paths.assert_not_called()

    def test_process_latest_release_backfills_missing_readmes(
        self, mock_client, inventory_manager, mock_jmx_model_extractor
    ):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.1, "libraries": []},
        )

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE
        mock_client.fetch_raw_file.return_value = "# README"

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        result = sync.process_latest_release()

        assert result is None
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert global_readme_dir.exists()

    def test_process_latest_release_skips_backfill_when_readmes_exist(
        self, mock_client, inventory_manager, mock_jmx_model_extractor
    ):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.1, "libraries": []},
        )
        inventory_manager.record_readme_sync(version, {})
        inventory_manager.save_jmx_models_index(version, models={"jvm": "metrics: []\n"}, manifest=None)

        mock_client.get_latest_release_tag.return_value = "v2.10.0"

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        result = sync.process_latest_release()

        assert result is None
        mock_client.resolve_ref_to_sha.assert_not_called()

    def test_one_readme_fetch_failure_others_written(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE
        mock_client.fetch_raw_file.side_effect = [
            GithubAPIError("timeout"),
            "# Apache README",
        ]

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        version = sync.process_latest_release()

        assert version == Version("2.10.0")
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert len(list(global_readme_dir.glob("*.md"))) == 1

        # Failure count should be recorded
        assert inventory_manager.get_readme_failures(version) == {"akka-actor-2.3": 1}
        assert not inventory_manager.readmes_synced(version)

    def test_readme_sync_retry_limit_collects_orphan(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        """When a library exhausts retries, it counts as synced and allows orphan pruning."""
        from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE

        # Set up an orphan file in global readmes
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        orphan_path = global_readme_dir / "old_orphan-123456789012.md"
        orphan_path.write_text("# orphan")

        # Simulate 2 previous failures for akka-actor-2.3 on both release and snapshot
        inventory_manager.record_readme_sync(Version("2.10.0"), {"akka-actor-2.3": 2})
        inventory_manager.record_readme_sync(Version("2.10.1-SNAPSHOT"), {"akka-actor-2.3": 2})

        # 3rd failure for akka-actor-2.3, success for apache-httpclient-4.3
        def fetch_raw_file_side_effect(path, ref):
            if "akka" in path:
                raise GithubAPIError("permanent 404")
            return "# Apache README"

        mock_client.fetch_raw_file.side_effect = fetch_raw_file_side_effect

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        sync.sync()

        # akka-actor-2.3 reaches max attempts (3) -> version marked synced -> orphan pruned
        assert inventory_manager.readmes_synced(Version("2.10.0"))
        assert inventory_manager.readmes_synced(Version("2.10.1-SNAPSHOT"))
        assert not orphan_path.exists()

    def test_resolve_ref_failure_does_not_abort_sync(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.side_effect = GithubAPIError("API down")

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        version = sync.process_latest_release()

        assert version == Version("2.10.0")
        assert inventory_manager.version_exists(version)

        # Global readme dir should NOT contain files for these libraries
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        if global_readme_dir.exists():
            files = [f.name for f in global_readme_dir.glob("*.md")]
            assert not any("akka-actor" in f or "apache-httpclient" in f for f in files)

    def test_library_without_source_path_skipped(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        yaml_no_source = """
file_format: 0.5
libraries:
  instrumentation:
  - name: some-lib
"""
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = yaml_no_source
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = [
            {"type": "blob", "path": "instrumentation/some/lib/library/README.md"},
        ]

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        version = sync.process_latest_release()

        assert version == Version("2.10.0")
        mock_client.fetch_raw_file.assert_not_called()

    def test_sync_prunes_orphan_readmes(self, mock_client, inventory_manager, mock_jmx_model_extractor):
        """Verify that sync() actually calls prune_orphan_readmes when complete."""
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = self._YAML_WITH_LIBRARIES
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        mock_client.fetch_tree.return_value = self._TREE
        mock_client.fetch_raw_file.return_value = "# README"

        # Create an orphan file in global readmes
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        orphan_file = global_readme_dir / "orphan-123456789012.md"
        orphan_file.write_text("orphan content")

        sync = InstrumentationSync(mock_client, inventory_manager, jmx_model_extractor=mock_jmx_model_extractor)
        sync.sync()

        # Orphan file should be pruned
        assert not orphan_file.exists()

    def test_release_sync_writes_jmx_models(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.30.0"
        mock_client.fetch_instrumentation_list.return_value = "file_format: 0.5\nlibraries: []\n"
        mock_client.resolve_ref_to_sha.return_value = "sha123"

        sync.jmx_model_extractor.discover_jmx_model_paths.return_value = (
            {
                "jvm": "instrumentation/jmx-metrics/model/jvm.yaml",
                "tomcat": "instrumentation/jmx-metrics/model/tomcat.yaml",
            },
            "instrumentation/jmx-metrics/model/manifest.yaml",
        )
        sync.jmx_model_extractor.fetch_model.side_effect = [
            "jvm-model",
            "tomcat-model",
            "manifest-model",
        ]

        version = sync.process_latest_release()

        assert version == Version("2.30.0")
        index_path = sync.inventory_manager.get_version_dir(version) / "jmx-models.yaml"
        assert index_path.exists()
        assert sync.inventory_manager.get_jmx_store_dir().exists()
        index = yaml.safe_load(index_path.read_text(encoding="utf-8"))
        assert set(index["models"]) == {"jvm", "tomcat"}
        assert "manifest" not in index["models"]
        assert index["manifest"]

    def test_process_latest_release_backfills_missing_jmx_index(self, sync, mock_client, inventory_manager):
        version = Version("2.30.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.5, "libraries": []},
        )
        inventory_manager.record_readme_sync(version, {})

        mock_client.get_latest_release_tag.return_value = "v2.30.0"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        sync.jmx_model_extractor.discover_jmx_model_paths.return_value = (
            {"jvm": "instrumentation/jmx-metrics/model/jvm.yaml"},
            None,
        )
        sync.jmx_model_extractor.fetch_model.return_value = "jvm-model"

        result = sync.process_latest_release()

        assert result is None
        assert inventory_manager.jmx_models_index_exists(version)

    @pytest.mark.parametrize("failed_file", ["model", "manifest"])
    def test_release_sync_does_not_write_partial_jmx_index(self, sync, mock_client, inventory_manager, failed_file):
        from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError

        mock_client.get_latest_release_tag.return_value = "v2.30.0"
        mock_client.fetch_instrumentation_list.return_value = "file_format: 0.5\nlibraries: []\n"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        sync.jmx_model_extractor.discover_jmx_model_paths.return_value = (
            {"jvm": "instrumentation/jmx-metrics/model/jvm.yaml"},
            "instrumentation/jmx-metrics/model/manifest.yaml",
        )
        if failed_file == "model":
            sync.jmx_model_extractor.fetch_model.side_effect = [
                GithubAPIError("model fetch failed"),
                "manifest-model",
            ]
        else:
            sync.jmx_model_extractor.fetch_model.side_effect = [
                "jvm-model",
                GithubAPIError("manifest fetch failed"),
            ]

        version = sync.process_latest_release()

        assert version == Version("2.30.0")
        assert not inventory_manager.jmx_models_index_exists(version)
        assert not inventory_manager.get_jmx_store_dir().exists()

    def test_jmx_tree_discovery_failure_does_not_abort_release_sync(self, sync, mock_client, inventory_manager):
        from java_instrumentation_watcher.java_instrumentation_client import GithubAPIError

        mock_client.get_latest_release_tag.return_value = "v2.30.0"
        mock_client.fetch_instrumentation_list.return_value = "file_format: 0.5\nlibraries: []\n"
        mock_client.resolve_ref_to_sha.return_value = "sha123"
        sync.jmx_model_extractor.discover_jmx_model_paths.side_effect = GithubAPIError("tree fetch failed")

        version = sync.process_latest_release()

        assert version == Version("2.30.0")
        assert not inventory_manager.jmx_models_index_exists(version)
        assert not inventory_manager.get_jmx_store_dir().exists()
