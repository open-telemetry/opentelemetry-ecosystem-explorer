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
"""Tests for main entry point."""

from unittest.mock import MagicMock, patch

import pytest
from explorer_db_builder.main import (
    get_release_versions,
    process_version,
    run_builder,
    run_javaagent_builder,
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
        mock_inventory_manager.list_versions.return_value = []

        with pytest.raises(ValueError, match="No versions found in inventory"):
            get_release_versions(mock_inventory_manager)

    def test_get_release_versions_only_prereleases(self, mock_inventory_manager):
        versions = [
            Version("2.0.0-beta"),
            Version("1.0.0-alpha"),
        ]
        mock_inventory_manager.list_versions.return_value = versions

        with pytest.raises(ValueError, match="No release versions found.*only prereleases"):
            get_release_versions(mock_inventory_manager)

    def test_get_release_versions_filters_prereleases(self, mock_inventory_manager):
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
        version = Version("2.0.0")
        inventory_data = {
            "file_format": 0.2,
            "libraries": [
                {"name": "lib1", "version": "1.0"},
                {"name": "lib2", "version": "2.0"},
            ],
            "custom": [{"name": "custom1"}],
        }
        library_map = {"lib1": "hash1", "lib2": "hash2"}
        custom_map = {"custom1": "hash3"}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        # write_libraries will be called twice (libraries, custom)
        mock_db_writer.write_libraries.side_effect = [library_map, custom_map]

        process_version(version, mock_inventory_manager, mock_db_writer)

        mock_inventory_manager.load_versioned_inventory.assert_called_once_with(version)
        assert mock_db_writer.write_libraries.call_count == 2
        mock_db_writer.write_version_index.assert_called_once_with(version, library_map, custom_map)

    def test_process_version_missing_libraries_key(self, mock_inventory_manager, mock_db_writer):
        version = Version("2.0.0")
        inventory_data = {"file_format": 0.2, "other_key": "value"}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(KeyError, match="missing 'libraries' and 'custom' keys"):
            process_version(version, mock_inventory_manager, mock_db_writer)

    def test_process_version_empty_libraries(self, mock_inventory_manager, mock_db_writer):
        version = Version("2.0.0")
        inventory_data = {"file_format": 0.2, "libraries": [], "custom": []}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(ValueError, match="No instrumentations found"):
            process_version(version, mock_inventory_manager, mock_db_writer)

    def test_process_version_none_libraries(self, mock_inventory_manager, mock_db_writer):
        version = Version("2.0.0")
        inventory_data = {"file_format": 0.2, "libraries": None}

        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data

        with pytest.raises(ValueError, match="No instrumentations found"):
            process_version(version, mock_inventory_manager, mock_db_writer)


class TestRunJavaagentBuilder:
    def test_run_builder_success(self, mock_inventory_manager, mock_db_writer):
        """Returns 0 on successful execution."""
        versions = [Version("2.0.0"), Version("1.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1", "version": "1.0"}]}
        library_map = {"lib1": "hash1"}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = library_map

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 0
        assert mock_db_writer.write_version_list.called
        mock_db_writer.write_version_list.assert_called_once_with(versions)

    def test_run_builder_value_error(self, mock_inventory_manager, mock_db_writer):
        mock_inventory_manager.list_versions.return_value = []

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_key_error(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("2.0.0")]
        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = {"file_format": 0.2, "wrong_key": []}

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_os_error(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("2.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.side_effect = OSError("Disk error")

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_unexpected_error(self, mock_inventory_manager, mock_db_writer):
        mock_inventory_manager.list_versions.side_effect = RuntimeError("Unexpected")

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 1

    def test_run_builder_processes_all_versions(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("3.0.0"), Version("2.0.0"), Version("1.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1"}]}
        library_map = {"lib1": "hash1"}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = library_map

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 0
        # load_versioned_inventory called once per version during backfill
        assert mock_inventory_manager.load_versioned_inventory.call_count == 3
        assert mock_db_writer.write_libraries.call_count == 3
        assert mock_db_writer.write_version_index.call_count == 3

    def test_run_builder_uses_backfilled_inventories(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("1.0.0"), Version("2.0.0")]
        inventory_1_0 = {
            "file_format": 0.2,
            "libraries": [{"name": "lib1"}],
        }
        inventory_2_0 = {
            "file_format": 0.2,
            "libraries": [{"name": "lib1", "display_name": "Library 1"}],
        }
        library_map = {"lib1": "hash1"}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.side_effect = [
            inventory_1_0,
            inventory_2_0,
        ]
        mock_db_writer.write_libraries.return_value = library_map

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer)

        assert exit_code == 0
        assert mock_inventory_manager.load_versioned_inventory.call_count == 2

        # Verify backfilled data is written: version 1.0.0 should have display_name backfilled
        write_calls = mock_db_writer.write_libraries.call_args_list
        assert len(write_calls) == 2

        # First call is for version 1.0.0 - should have backfilled display_name
        libraries_v1 = write_calls[0][0][0]
        assert len(libraries_v1) == 1
        assert libraries_v1[0]["name"] == "lib1"
        assert libraries_v1[0]["display_name"] == "Library 1"

        # Second call is for version 2.0.0 - should have original display_name
        libraries_v2 = write_calls[1][0][0]
        assert len(libraries_v2) == 1
        assert libraries_v2[0]["name"] == "lib1"
        assert libraries_v2[0]["display_name"] == "Library 1"

    def test_run_builder_with_clean_false(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("1.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer, clean=False)

        assert exit_code == 0
        mock_db_writer.clean.assert_not_called()

    def test_run_builder_with_clean_true(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("1.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        exit_code = run_javaagent_builder(mock_inventory_manager, mock_db_writer, clean=True)

        assert exit_code == 0
        mock_db_writer.clean.assert_called_once()

    def test_run_builder_clean_before_processing(self, mock_inventory_manager, mock_db_writer):
        versions = [Version("1.0.0")]
        inventory_data = {"file_format": 0.2, "libraries": [{"name": "lib1"}]}

        mock_inventory_manager.list_versions.return_value = versions
        mock_inventory_manager.load_versioned_inventory.return_value = inventory_data
        mock_db_writer.write_libraries.return_value = {"lib1": "hash1"}

        call_order = []
        mock_db_writer.clean.side_effect = lambda: call_order.append("clean")
        mock_inventory_manager.list_versions.side_effect = lambda: (call_order.append("list_versions"), versions)[1]

        run_javaagent_builder(mock_inventory_manager, mock_db_writer, clean=True)

        assert call_order[0] == "clean"
        assert call_order[1] == "list_versions"


class TestMain:
    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_success(self, mock_parse_args, mock_exit, mock_run_builder):
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = False
        mock_args.ecosystem = "all"
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 0

        main()

        mock_run_builder.assert_called_once_with(clean=False, ecosystem="all")
        mock_exit.assert_called_once_with(0)

    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_failure(self, mock_parse_args, mock_exit, mock_run_builder):
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = False
        mock_args.ecosystem = "all"
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 1

        main()

        mock_run_builder.assert_called_once_with(clean=False, ecosystem="all")
        mock_exit.assert_called_once_with(1)

    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_with_clean_flag(self, mock_parse_args, mock_exit, mock_run_builder):
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = True
        mock_args.ecosystem = "all"
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 0

        main()

        mock_run_builder.assert_called_once_with(clean=True, ecosystem="all")
        mock_exit.assert_called_once_with(0)

    @patch("explorer_db_builder.main.run_builder")
    @patch("explorer_db_builder.main.sys.exit")
    @patch("explorer_db_builder.main.argparse.ArgumentParser.parse_args")
    def test_main_with_ecosystem_flag(self, mock_parse_args, mock_exit, mock_run_builder):
        """Main passes ecosystem flag to run_builder."""
        from explorer_db_builder.main import main

        mock_args = MagicMock()
        mock_args.clean = False
        mock_args.ecosystem = "collector"
        mock_parse_args.return_value = mock_args
        mock_run_builder.return_value = 0

        main()

        mock_run_builder.assert_called_once_with(clean=False, ecosystem="collector")
        mock_exit.assert_called_once_with(0)


class TestRunBuilderOrchestrator:
    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_all_succeed(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 0
        mock_config.return_value = 0
        mock_collector.return_value = 0

        result = run_builder(clean=False)

        assert result == 0
        mock_java.assert_called_once()
        mock_config.assert_called_once()
        mock_collector.assert_called_once()

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_javaagent_fails_others_still_run(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 1
        mock_config.return_value = 0
        mock_collector.return_value = 0

        result = run_builder(clean=False)

        assert result == 1
        mock_java.assert_called_once()
        mock_config.assert_called_once()
        mock_collector.assert_called_once()

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_config_fails_returns_1(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 0
        mock_config.return_value = 1
        mock_collector.return_value = 0

        result = run_builder(clean=False)

        assert result == 1

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_all_fail_returns_1(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 1
        mock_config.return_value = 1
        mock_collector.return_value = 1

        result = run_builder(clean=False)

        assert result == 1

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_clean_passed_to_all(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 0
        mock_config.return_value = 0
        mock_collector.return_value = 0

        run_builder(clean=True)

        mock_java.assert_called_once_with(clean=True)
        mock_config.assert_called_once_with(clean=True)
        mock_collector.assert_called_once_with(clean=True)

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_ecosystem_javaagent_only(self, mock_java, mock_config, mock_collector):
        mock_java.return_value = 0

        result = run_builder(clean=False, ecosystem="javaagent")

        assert result == 0
        mock_java.assert_called_once()
        mock_config.assert_not_called()
        mock_collector.assert_not_called()

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_ecosystem_configuration_only(self, mock_java, mock_config, mock_collector):
        mock_config.return_value = 0

        result = run_builder(clean=False, ecosystem="configuration")

        assert result == 0
        mock_java.assert_not_called()
        mock_config.assert_called_once()
        mock_collector.assert_not_called()

    @patch("explorer_db_builder.main.run_collector_builder")
    @patch("explorer_db_builder.main.run_configuration_builder")
    @patch("explorer_db_builder.main.run_javaagent_builder")
    def test_ecosystem_collector_only(self, mock_java, mock_config, mock_collector):
        mock_collector.return_value = 0

        result = run_builder(clean=False, ecosystem="collector")

        assert result == 0
        mock_java.assert_not_called()
        mock_config.assert_not_called()
        mock_collector.assert_called_once()
