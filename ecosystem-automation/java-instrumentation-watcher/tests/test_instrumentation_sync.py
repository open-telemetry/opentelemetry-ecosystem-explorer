"""Tests for instrumentation sync orchestrator."""

import tempfile
from unittest.mock import Mock

import pytest
from java_instrumentation_watcher.instrumentation_sync import InstrumentationSync
from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


class TestInstrumentationSync:
    """Test InstrumentationSync class."""

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
        # Setup mock
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
            instrumentations=[],
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
            instrumentations=[],
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
            instrumentations=[],
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

    def test_parse_instrumentation_yaml(self, sync):
        yaml_content = """
file_format: 0.1
libraries:
  akka:
  - id: akka-actor
    name: Akka Actor
    stability: stable
  apache:
  - id: apache-camel
    name: Apache Camel
    stability: experimental
"""

        data = sync._parse_instrumentation_yaml(yaml_content)

        assert isinstance(data, dict)
        assert data["file_format"] == 0.1
        assert "libraries" in data
        assert "akka" in data["libraries"]
        assert "apache" in data["libraries"]

    def test_parse_instrumentation_yaml_empty(self, sync):
        yaml_content = ""
        data = sync._parse_instrumentation_yaml(yaml_content)
        assert data == {}

    def test_parse_instrumentation_yaml_no_instrumentations_key(self, sync):
        yaml_content = """
some_other_key: value
"""
        data = sync._parse_instrumentation_yaml(yaml_content)
        assert data == {"some_other_key": "value"}

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

    def test_parse_instrumentation_yaml_malformed(self, sync):
        yaml_content = """
file_format: 0.1
libraries:
  akka:
  - id: akka-actor
    name: Akka Actor
  invalid yaml here: [unclosed
"""

        with pytest.raises(ValueError, match="Error parsing instrumentation YAML"):
            sync._parse_instrumentation_yaml(yaml_content)

    def test_update_snapshot_with_yaml_error(self, sync, mock_client):
        mock_client.get_latest_release_tag.return_value = "v2.10.0"
        mock_client.fetch_instrumentation_list.return_value = "malformed: [yaml"

        with pytest.raises(ValueError, match="Error parsing instrumentation YAML"):
            sync.update_snapshot()
