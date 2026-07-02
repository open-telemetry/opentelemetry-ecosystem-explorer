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
"""Tests for the ecosystem stats aggregator."""

from explorer_db_builder.ecosystem_stats import (
    count_unique_collector_component_ids,
    count_unique_java_library_names,
)


def _inventory(libraries=None, custom=None):
    inv = {}
    if libraries is not None:
        inv["libraries"] = libraries
    if custom is not None:
        inv["custom"] = custom
    return inv


class TestCountUniqueLibraryNames:
    def test_counts_libraries_across_a_single_version(self):
        inventories = [_inventory(libraries=[{"name": "jdbc"}, {"name": "servlet-5.0"}])]

        assert count_unique_java_library_names(inventories) == 2

    def test_dedups_names_repeated_across_versions(self):
        inventories = [
            _inventory(libraries=[{"name": "jdbc"}]),
            _inventory(libraries=[{"name": "jdbc"}]),
        ]

        assert count_unique_java_library_names(inventories) == 1

    def test_counts_a_name_added_in_an_older_version_only(self):
        """A library present only in an older version still contributes to the total."""
        inventories = [
            _inventory(libraries=[{"name": "jdbc"}]),
            _inventory(libraries=[{"name": "jdbc"}, {"name": "removed-lib"}]),
        ]

        assert count_unique_java_library_names(inventories) == 2

    def test_combines_libraries_and_custom(self):
        inventories = [_inventory(libraries=[{"name": "jdbc"}], custom=[{"name": "custom-a"}])]

        assert count_unique_java_library_names(inventories) == 2

    def test_same_name_in_libraries_and_custom_counts_once(self):
        inventories = [_inventory(libraries=[{"name": "shared"}], custom=[{"name": "shared"}])]

        assert count_unique_java_library_names(inventories) == 1

    def test_item_missing_name_is_skipped(self):
        inventories = [_inventory(libraries=[{"version": "1.0"}, {"name": "kept"}])]

        assert count_unique_java_library_names(inventories) == 1

    def test_empty_inventories_returns_zero(self):
        assert count_unique_java_library_names([]) == 0

    def test_inventory_with_no_libraries_or_custom_key_contributes_nothing(self):
        assert count_unique_java_library_names([_inventory()]) == 0


class TestCountUniqueComponentIds:
    def test_counts_ids_across_a_single_version(self):
        components_by_version = [[{"id": "core-nopreceiver"}, {"id": "contrib-otlpreceiver"}]]

        assert count_unique_collector_component_ids(components_by_version) == 2

    def test_dedups_ids_repeated_across_versions(self):
        components_by_version = [
            [{"id": "core-nopreceiver"}],
            [{"id": "core-nopreceiver"}],
        ]

        assert count_unique_collector_component_ids(components_by_version) == 1

    def test_counts_an_id_removed_in_a_newer_version(self):
        """A component present only in an older version still contributes to the total."""
        components_by_version = [
            [{"id": "core-nopreceiver"}],
            [{"id": "core-nopreceiver"}, {"id": "core-removedreceiver"}],
        ]

        assert count_unique_collector_component_ids(components_by_version) == 2

    def test_component_missing_id_is_skipped(self):
        components_by_version = [[{"name": "no-id"}, {"id": "kept"}]]

        assert count_unique_collector_component_ids(components_by_version) == 1

    def test_empty_input_returns_zero(self):
        assert count_unique_collector_component_ids([]) == 0
