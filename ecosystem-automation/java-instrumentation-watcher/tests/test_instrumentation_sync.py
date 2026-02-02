"""Tests for instrumentation sync orchestrator."""

import tempfile
from unittest.mock import Mock

import pytest
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
    def sync(self, mock_client, inventory_manager):
        return InstrumentationSync(mock_client, inventory_manager)

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

        mock_client.get_latest_release_tag.return_value = "v2.10.0"

        result = sync.process_latest_release()

        assert result is None
        mock_client.fetch_instrumentation_list.assert_not_called()

    def test_update_snapshot(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = """
instrumentations:
  - id: snapshot-test
    name: Snapshot Test
"""

        snapshot_version = sync.update_snapshot()

        assert snapshot_version == Version("2.10.1-SNAPSHOT")
        mock_client.fetch_instrumentation_list.assert_called_once_with(ref="main")

        # Verify saved to inventory
        assert sync.inventory_manager.version_exists(Version("2.10.1-SNAPSHOT"))

    def test_update_snapshot_cleans_old_snapshots(self, sync, mock_client, inventory_manager):
        old_snapshot = Version("2.9.0-SNAPSHOT")
        inventory_manager.save_versioned_inventory(
            version=old_snapshot,
            instrumentations={"file_format": 0.1, "libraries": {}},
        )

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
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

        mock_client.get_latest_release_tag.return_value = "v2.10.0"
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
