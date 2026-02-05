"""Tests for main entry point."""

from unittest.mock import MagicMock, patch

import pytest
from explorer_db_builder.main import (
    get_release_versions,
    process_version,
    run_builder,
)
from semantic_version import Version


@pytest.fixture
def mock_inventory_manager():
    mock = MagicMock()
    return mock


@pytest.fixture
def mock_db_writer():
    mock = MagicMock()
    mock.get_stats.return_value = {"files_written": 10, "total_bytes": 1024}
    return mock


class TestGetReleaseVersions:
    def test_get_release_versions_success(self, mock_inventory_manager):
        """Returns release versions when available."""
        versions = [
            Version("2.0.0"),
            Version("1.5.0"),
            Version("1.0.0-beta"),
        ]
        mock_inventory_manager.list_versions.return_value = versions

        result = get_release_versions(mock_inventory_manager)

        assert len(result) == 2
        assert Version("2.0.0") in result
        assert Version("1.5.0") in result
        assert Version("1.0.0-beta") not in result

    def test_get_release_versions_no_versions(self, mock_inventory_manager):
        """Raises ValueError when no versions found."""
        mock_inventory_manager.list_versions.return_value = []

        with pytest.raises(ValueError, match="No versions found in inventory"):
            get_release_versions(mock_inventory_manager)

    def test_get_release_versions_only_prereleases(self, mock_inventory_manager):
        """Raises ValueError when only prereleases exist."""
        versions = [
            Version("2.0.0-beta"),
            Version("1.0.0-alpha"),
        ]
        mock_inventory_manager.list_versions.return_value = versions

        with pytest.raises(ValueError, match="No release versions found.*only prereleases"):
            get_release_versions(mock_inventory_manager)

    def test_get_release_versions_filters_prereleases(self, mock_inventory_manager):
        """Filters out all prerelease versions."""
        versions = [
            Version("3.0.0"),
            Version("2.5.0-rc1"),
            Version("2.0.0"),
            Version("2.0.0-beta"),
            Version("1.0.0"),
        ]
        mock_inventory_manager.list_versions.return_value = versions

        result = get_release_versions(mock_inventory_manager)

        assert len(result) == 3
        for version in result:
            assert not version.prerelease


class TestProcessVersion:
    def test_process_version_success(self, mock_inventory_manager, mock_db_writer):
        """Successfully processes a version with valid data."""
        version = Version("2.0.0")
        inventory_data = {
            "libraries": [
                {"name": "lib1", "version": "1.0"},
                {"name": "lib2", "version": "2.0"},
            ]
        }
        library_map = {"lib1": "hash1", "lib2": "hash2"}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = library_map

        process_version(version, mock_inventory_manager, mock_db_writer)

        mock_inventory_manager.load_versioned_inventory.assert_called_once_with(version)
        mock_db_writer.write_libraries.assert_called_once_with(inventory_data["libraries"])
        mock_db_writer.write_version_index.assert_called_once_with(version, library_map)

    def test_process_version_missing_libraries_key(self, mock_inventory_manager, mock_db_writer):
        """Raises KeyError when inventory missing libraries key."""
        version = Version("2.0.0")
        inventory_data = {"other_key": "value"}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(KeyError, match="missing 'libraries' key"):
            process_version(version, mock_inventory_manager, mock_db_writer)

    def test_process_version_empty_libraries(self, mock_inventory_manager, mock_db_writer):
        """Raises ValueError when libraries list is empty."""
        version = Version("2.0.0")
        inventory_data = {"libraries": []}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(ValueError, match="No libraries found"):
            process_version(version, mock_inventory_manager, mock_db_writer)

    def test_process_version_none_libraries(self, mock_inventory_manager, mock_db_writer):
        """Raises ValueError when libraries is None."""
        version = Version("2.0.0")
        inventory_data = {"libraries": None}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(ValueError, match="No libraries found"):
            process_version(version, mock_inventory_manager, mock_db_writer)


class TestRunBuilder:
    def test_run_builder_success(self, mock_inventory_manager, mock_db_writer):
        """Returns 0 on successful execution."""
        versions = [Version("2.0.0"), Version("1.0.0")]
        inventory_data = {"libraries": [{"name": "lib1", "version": "1.0"}]}
        library_map = {"lib1": "hash1"}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = library_map

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 0
        assert mock_db_writer.write_version_list.called
        mock_db_writer.write_version_list.assert_called_once_with(versions)

    def test_run_builder_value_error(self, mock_inventory_manager, mock_db_writer):
        """Returns 1 on ValueError."""
        mock_inventory_manager.list_versions.return_value = []

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_key_error(self, mock_inventory_manager, mock_db_writer):
        """Returns 1 on KeyError."""
        versions = [Version("2.0.0")]
        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = {"wrong_key": []}

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_os_error(self, mock_inventory_manager, mock_db_writer):
        """Returns 1 on OSError."""
        versions = [Version("2.0.0")]
        inventory_data = {"libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.side_effect = OSError("Disk error")

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_unexpected_error(self, mock_inventory_manager, mock_db_writer):
        """Returns 1 on unexpected exceptions."""
        mock_inventory_manager.list_versions.side_effect = RuntimeError("Unexpected")

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_processes_all_versions(self, mock_inventory_manager, mock_db_writer):
        """All versions are processed."""
        versions = [Version("3.0.0"), Version("2.0.0"), Version("1.0.0")]
        inventory_data = {"libraries": [{"name": "lib1"}]}
        library_map = {"lib1": "hash1"}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = library_map

        exit_code = run_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 0
        assert mock_inventory_manager.load_versioned_inventory.call_count == 3
        assert mock_db_writer.write_libraries.call_count == 3
        assert mock_db_writer.write_version_index.call_count == 3

    def test_run_builder_with_clean_false(self, mock_inventory_manager, mock_db_writer):
        """Clean is not called when clean=False."""
        versions = [Version("1.0.0")]
        inventory_data = {"libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        exit_code = run_builder(mock_inventory_manager, mock_db_writer, clean=False)

        assert exit_code == 0
        mock_db_writer.clean.assert_not_called()

    def test_run_builder_with_clean_true(self, mock_inventory_manager, mock_db_writer):
        """Clean is called when clean=True."""
        versions = [Version("1.0.0")]
        inventory_data = {"libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        exit_code = run_builder(mock_inventory_manager, mock_db_writer, clean=True)

        assert exit_code == 0
        mock_db_writer.clean.assert_called_once()

    def test_run_builder_clean_before_processing(self, mock_inventory_manager, mock_db_writer):
        """Clean is called before processing versions."""
        versions = [Version("1.0.0")]
        inventory_data = {"libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        call_order = []
        mock_db_writer.clean.side_effect = lambda: call_order.append("clean")
        mock_inventory_manager.list_versions.side_effect = lambda: (call_order.append("list_versions"), versions)[1]

        run_builder(mock_inventory_manager, mock_db_writer, clean=True)

        assert call_order[0] == "clean"
        assert call_order[1] == "list_versions"


class TestMain:
    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_success(self, mock_parse_args, mock_exit, mock_run_builder):
        """Main exits with code from run_builder."""
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = False
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 0

        main()

        mock_run_builder.assert_called_once_with(clean=False)
        mock_exit.assert_called_once_with(0)

    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_failure(self, mock_parse_args, mock_exit, mock_run_builder):
        """Main exits with error code on failure."""
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = False
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 1

        main()

        mock_run_builder.assert_called_once_with(clean=False)
        mock_exit.assert_called_once_with(1)

    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_with_clean_flag(self, mock_parse_args, mock_exit, mock_run_builder):
        """Main passes clean flag to run_builder."""
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = True
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 0

        main()

        mock_run_builder.assert_called_once_with(clean=True)
        mock_exit.assert_called_once_with(0)
