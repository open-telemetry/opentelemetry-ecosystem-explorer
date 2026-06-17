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
"""Tests for the global configuration aggregator."""

import copy

from explorer_db_builder.configuration_aggregator import build_global_configurations


def _config(name, **fields):
    return {"name": name, **fields}


def _inventory(libraries=None, custom=None):
    inv = {}
    if libraries is not None:
        inv["libraries"] = libraries
    if custom is not None:
        inv["custom"] = custom
    return inv


class TestBuildGlobalConfigurations:
    def test_unions_config_names_across_instrumentations(self):
        """Each distinct config name appears once, with its instrumentations listed."""
        inventories = [
            _inventory(
                libraries=[
                    {"name": "servlet-5.0", "configurations": [_config("otel.a")]},
                    {"name": "jdbc", "configurations": [_config("otel.b")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        names = [c["name"] for c in result]
        assert names == ["otel.a", "otel.b"]
        assert result[0]["instrumentations"] == ["servlet-5.0"]
        assert result[1]["instrumentations"] == ["jdbc"]

    def test_top_level_sorted_by_name(self):
        """Output list is sorted alphabetically by config name."""
        inventories = [
            _inventory(
                libraries=[
                    {"name": "x", "configurations": [_config("otel.zeta"), _config("otel.alpha")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert [c["name"] for c in result] == ["otel.alpha", "otel.zeta"]

    def test_instrumentations_sorted_alphabetically(self):
        """A config shared across instrumentations collapses to one entry with a sorted list."""
        inventories = [
            _inventory(
                libraries=[
                    {"name": "servlet-5.0", "configurations": [_config("otel.shared")]},
                    {"name": "jdbc", "configurations": [_config("otel.shared")]},
                    {"name": "armeria-1.3", "configurations": [_config("otel.shared")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert len(result) == 1
        assert result[0]["instrumentations"] == ["armeria-1.3", "jdbc", "servlet-5.0"]

    def test_newest_version_wins_on_conflicting_scalar(self):
        """When a scalar conflicts across versions, the newest version's value wins."""
        inventories = [
            # newest first
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", type="list")]}]),
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", type="string")]}]),
        ]

        result = build_global_configurations(inventories)

        assert result[0]["type"] == "list"

    def test_older_value_fills_field_absent_in_newest(self):
        """A field empty/absent in the newest version is filled from an older version."""
        inventories = [
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", description="")]}]),
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", description="from old")]}]),
        ]

        result = build_global_configurations(inventories)

        assert result[0]["description"] == "from old"

    def test_reads_from_both_libraries_and_custom(self):
        """Configs are collected from both libraries and custom lists."""
        inventories = [
            _inventory(
                libraries=[{"name": "lib-a", "configurations": [_config("otel.lib")]}],
                custom=[{"name": "custom-a", "configurations": [_config("otel.custom")]}],
            )
        ]

        result = build_global_configurations(inventories)

        assert [c["name"] for c in result] == ["otel.custom", "otel.lib"]

    def test_config_present_in_custom_only(self):
        """A config that exists only under custom is still aggregated."""
        inventories = [_inventory(custom=[{"name": "custom-a", "configurations": [_config("otel.only")]}])]

        result = build_global_configurations(inventories)

        assert [c["name"] for c in result] == ["otel.only"]
        assert result[0]["instrumentations"] == ["custom-a"]

    def test_dedups_instrumentation_across_versions(self):
        """The same (instrumentation, config) pair across versions collapses to one entry."""
        inventories = [
            _inventory(libraries=[{"name": "jdbc", "configurations": [_config("otel.j")]}]),
            _inventory(libraries=[{"name": "jdbc", "configurations": [_config("otel.j")]}]),
            _inventory(libraries=[{"name": "jdbc", "configurations": [_config("otel.j")]}]),
        ]

        result = build_global_configurations(inventories)

        assert result[0]["instrumentations"] == ["jdbc"]


class TestBuildGlobalConfigurationsEdgeCases:
    def test_config_missing_name_is_skipped(self):
        """A configuration entry without a name is skipped; siblings survive."""
        inventories = [
            _inventory(
                libraries=[
                    {"name": "ext", "configurations": [{"type": "string"}, _config("otel.kept")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert [c["name"] for c in result] == ["otel.kept"]

    def test_instrumentation_item_missing_name_is_skipped(self):
        """An instrumentation item without a name contributes nothing."""
        inventories = [
            _inventory(
                libraries=[
                    {"configurations": [_config("otel.orphan")]},
                    {"name": "ext", "configurations": [_config("otel.kept")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert [c["name"] for c in result] == ["otel.kept"]

    def test_empty_configurations_list_contributes_nothing(self):
        """A library with an empty configurations list adds no entries."""
        inventories = [_inventory(libraries=[{"name": "ext", "configurations": []}])]

        assert build_global_configurations(inventories) == []

    def test_absent_configurations_key_contributes_nothing(self):
        """A library with no configurations key at all is ignored."""
        inventories = [_inventory(libraries=[{"name": "ext"}])]

        assert build_global_configurations(inventories) == []

    def test_only_declared_fields_are_filled_from_older_versions(self):
        """Fields outside the merge set are NOT backfilled from older versions."""
        inventories = [
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c")]}]),
            _inventory(
                libraries=[
                    {
                        "name": "ext",
                        "configurations": [_config("otel.c", description="d", extra="x")],
                    }
                ]
            ),
        ]

        result = build_global_configurations(inventories)

        # description IS in the merge set, so it fills from the older version.
        assert result[0]["description"] == "d"
        # extra is NOT in the merge set, so it does not fill from older versions.
        assert "extra" not in result[0]

    def test_examples_filled_from_older_version_when_missing_on_newest(self):
        """examples is in the merge set, so a newest entry lacking it fills from an older version."""
        inventories = [
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c")]}]),
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", examples=["a", "b"])]}]),
        ]

        result = build_global_configurations(inventories)

        assert result[0]["examples"] == ["a", "b"]

    def test_examples_filled_from_sibling_instrumentation_in_same_version(self):
        """A config name shared across instrumentations fills examples from a sibling when the
        seed instrumentation lacks them."""
        inventories = [
            _inventory(
                libraries=[
                    # seed: first occurrence has no examples
                    {"name": "servlet-2.2", "configurations": [_config("otel.shared")]},
                    {"name": "servlet-3.0", "configurations": [_config("otel.shared", examples=["x"])]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert len(result) == 1
        assert result[0]["examples"] == ["x"]
        assert result[0]["instrumentations"] == ["servlet-2.2", "servlet-3.0"]

    def test_seed_fields_outside_merge_set_are_preserved(self):
        """Fields on the newest (seed) entry that aren't in the merge set still survive to output."""
        inventories = [
            _inventory(
                libraries=[
                    {"name": "ext", "configurations": [_config("otel.c", examples=["GET,POST"], type="list")]},
                ]
            )
        ]

        result = build_global_configurations(inventories)

        assert result[0]["examples"] == ["GET,POST"]
        assert result[0]["type"] == "list"

    def test_empty_inventories_returns_empty_list(self):
        """No inventories yields an empty list."""
        assert build_global_configurations([]) == []


class TestBuildGlobalConfigurationsImmutability:
    def test_does_not_mutate_input_inventories(self):
        """Aggregation must not mutate the input inventory dicts or their nested values."""
        inventories = [
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", examples=["GET,POST"])]}]),
            _inventory(libraries=[{"name": "ext", "configurations": [_config("otel.c", description="older")]}]),
        ]
        snapshot = copy.deepcopy(inventories)

        build_global_configurations(inventories)

        assert inventories == snapshot
