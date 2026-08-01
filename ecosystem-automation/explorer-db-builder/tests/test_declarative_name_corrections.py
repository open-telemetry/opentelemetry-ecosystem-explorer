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
"""Tests for declarative_name corrections."""

from explorer_db_builder.declarative_name_corrections import (
    apply_declarative_name_corrections,
    backfill_underdocumented_configs,
    normalize_config_descriptions,
)
from semantic_version import Version


def _config(name, declarative_name):
    return {"name": name, "declarative_name": declarative_name}


class TestApplyDeclarativeNameCorrections:
    def test_rewrites_known_bad_declarative_name(self):
        """java.common.peer_service_mapping is rewritten to java.common.service_peer_mapping."""
        inventory = {
            "libraries": [
                {
                    "name": "dubbo-2.7",
                    "configurations": [
                        _config(
                            "otel.instrumentation.common.peer-service-mapping",
                            "java.common.peer_service_mapping",
                        )
                    ],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["declarative_name"] == "java.common.service_peer_mapping"
        # The config's own name is untouched — only declarative_name is corrected.
        assert config["name"] == "otel.instrumentation.common.peer-service-mapping"

    def test_rewrites_in_custom_list(self):
        """Corrections apply to the custom list as well as libraries."""
        inventory = {
            "custom": [
                {
                    "name": "custom-thing",
                    "configurations": [_config("some.config", "java.common.peer_service_mapping")],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        assert inventory["custom"][0]["configurations"][0]["declarative_name"] == "java.common.service_peer_mapping"

    def test_leaves_unrelated_declarative_names_untouched(self):
        """Declarative names without a correction entry are left as-is."""
        inventory = {
            "libraries": [
                {
                    "name": "lib",
                    "configurations": [_config("c", "java.common.something_else")],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        assert inventory["libraries"][0]["configurations"][0]["declarative_name"] == "java.common.something_else"

    def test_returns_the_same_inventory_object(self):
        """The function mutates in place and returns the same object."""
        inventory = {"libraries": []}
        assert apply_declarative_name_corrections(inventory) is inventory

    def test_handles_missing_and_none_collections(self):
        """Missing libraries/custom, None lists, and missing configurations don't raise."""
        # No libraries/custom keys at all.
        apply_declarative_name_corrections({})
        # Explicit None lists (YAML `libraries:` parses as None).
        apply_declarative_name_corrections({"libraries": None, "custom": None})
        # Item without configurations, and None configurations.
        apply_declarative_name_corrections({"libraries": [{"name": "a"}, {"name": "b", "configurations": None}]})

    def test_skips_non_dict_items_and_configs(self):
        """Malformed entries that aren't dicts are ignored rather than raising."""
        inventory = {
            "libraries": [
                "not-a-dict",
                {"name": "lib", "configurations": ["nope", None]},
            ]
        }

        # Should not raise.
        apply_declarative_name_corrections(inventory)

    def test_config_without_declarative_name_is_ignored(self):
        """A config missing declarative_name is left untouched."""
        inventory = {"libraries": [{"name": "lib", "configurations": [{"name": "c"}]}]}

        apply_declarative_name_corrections(inventory)

        assert "declarative_name" not in inventory["libraries"][0]["configurations"][0]

    def test_injects_structured_list_schema_for_service_peer_mapping(self):
        """peer-service-mapping receives a structured_list schema injection (keyed on config name)."""
        inventory = {
            "libraries": [
                {
                    "name": "some-lib",
                    "configurations": [
                        {
                            "name": "otel.instrumentation.common.peer-service-mapping",
                            "declarative_name": "java.common.service_peer_mapping",
                        }
                    ],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["declarative_type"] == "structured_list"
        assert config["declarative_schema"]["type"] == "object"
        assert "peer" in config["declarative_schema"]["required"]
        assert "service_name" in config["declarative_schema"]["required"]

    def test_normalizes_peer_service_mapping_with_unset_declarative_name(self):
        """Old versions (<=2.27.0) shipped peer-service-mapping with declarative_name unset.

        Keying the normalization on the stable config ``name`` ensures these versions still get the
        full canonical shape (declarative_name + structured schema), so they don't differ from
        2.28.x in the release comparison.
        """
        inventory = {
            "libraries": [
                {
                    "name": "akka-http-10.0",
                    "configurations": [
                        {
                            "name": "otel.instrumentation.common.peer-service-mapping",
                            "declarative_name": None,
                            "type": "map",
                        }
                    ],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["declarative_name"] == "java.common.service_peer_mapping"
        assert config["type"] == "map"
        assert config["declarative_type"] == "structured_list"
        assert config["declarative_schema"]["required"] == ["peer", "service_name"]

    def test_normalizes_peer_service_mapping_type_back_to_map(self):
        """v2.29.0 regressed peer-service-mapping ``type`` to structured_list; force it back to map.

        The system-property form is a map; only the declarative form is a structured_list. See
        upstream PR #19077. Without this the field shows a spurious cross-version diff.
        """
        inventory = {
            "libraries": [
                {
                    "name": "akka-http-10.0",
                    "configurations": [
                        {
                            "name": "otel.instrumentation.common.peer-service-mapping",
                            "declarative_name": "java.common.service_peer_mapping",
                            "type": "structured_list",
                        }
                    ],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["type"] == "map", "system-property type must be normalized to map"
        assert config["declarative_type"] == "structured_list"

    def test_peer_service_mapping_type_corrected_after_declarative_name_rewrite(self):
        """Old versions (wrong declarative_name, type already map) stay map after correction."""
        inventory = {
            "libraries": [
                {
                    "name": "akka-http-10.0",
                    "configurations": [
                        {
                            "name": "otel.instrumentation.common.peer-service-mapping",
                            "declarative_name": "java.common.peer_service_mapping",
                            "type": "map",
                        }
                    ],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["declarative_name"] == "java.common.service_peer_mapping"
        assert config["type"] == "map"
        assert config["declarative_type"] == "structured_list"

    def test_injects_structured_list_schema_for_url_template_rules(self):
        """url_template_rules receives a structured_list schema injection."""
        inventory = {
            "libraries": [
                {
                    "name": "some-lib",
                    "configurations": [{"declarative_name": "some.prefix.url_template_rules"}],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["declarative_type"] == "structured_list"
        assert config["declarative_schema"]["type"] == "object"
        assert "pattern" in config["declarative_schema"]["required"]
        assert "template" in config["declarative_schema"]["required"]
        assert "override" in config["declarative_schema"]["properties"]


class TestConfigNameFallback:
    def test_declarative_only_config_gets_name_from_declarative_name(self):
        """A config with a declarative_name but no name falls back to the declarative_name."""
        inventory = {
            "libraries": [
                {
                    "name": "apache-httpasyncclient-4.1",
                    "configurations": [{"declarative_name": "java.common.http.client.url_template_rules"}],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        config = inventory["libraries"][0]["configurations"][0]
        assert config["name"] == "java.common.http.client.url_template_rules"

    def test_existing_name_is_not_overwritten(self):
        """A config that already has a name keeps it; the fallback only fills a missing name."""
        inventory = {
            "libraries": [
                {
                    "name": "lib",
                    "configurations": [_config("otel.instrumentation.real.name", "java.common.real")],
                }
            ]
        }

        apply_declarative_name_corrections(inventory)

        assert inventory["libraries"][0]["configurations"][0]["name"] == "otel.instrumentation.real.name"

    def test_config_without_name_or_declarative_name_stays_nameless(self):
        """No declarative_name means there's nothing to fall back to; name stays absent."""
        inventory = {"libraries": [{"name": "lib", "configurations": [{"description": "x"}]}]}

        apply_declarative_name_corrections(inventory)

        assert "name" not in inventory["libraries"][0]["configurations"][0]


class TestNormalizeConfigDescriptions:
    _DN = "java.common.db.query_sanitization.enabled"

    def _inventory(self, description):
        return {
            "libraries": [
                {
                    "name": "some-lib",
                    "configurations": [
                        {
                            "name": "otel.instrumentation.common.db.query-sanitization.enabled",
                            "declarative_name": self._DN,
                            "description": description,
                        }
                    ],
                }
            ]
        }

    def test_pins_older_description_to_newest(self):
        """Whitelisted configs get the newest version's description in every version."""
        newest = self._inventory("Enables query sanitization for database queries.")
        older = self._inventory("Enables or disables query sanitization for database queries.")

        normalize_config_descriptions([newest, older])  # newest-first

        assert older["libraries"][0]["configurations"][0]["description"] == (
            "Enables query sanitization for database queries."
        )
        # Newest is unchanged.
        assert newest["libraries"][0]["configurations"][0]["description"] == (
            "Enables query sanitization for database queries."
        )

    def test_does_not_touch_non_whitelisted_configs(self):
        """A config whose declarative_name isn't whitelisted keeps its per-version description."""

        def inv(description):
            config = _config("c", "java.common.not_whitelisted") | {"description": description}
            return {"libraries": [{"name": "lib", "configurations": [config]}]}

        newest = inv("new")
        older = inv("old")

        normalize_config_descriptions([newest, older])

        assert older["libraries"][0]["configurations"][0]["description"] == "old"

    def test_scoped_per_instrumentation(self):
        """Two libraries referencing the same whitelisted config each keep their own newest value."""
        newest = {
            "libraries": [
                {
                    "name": "lib-a",
                    "configurations": [
                        {"name": "n", "declarative_name": self._DN, "description": "A newest"},
                    ],
                },
                {
                    "name": "lib-b",
                    "configurations": [
                        {"name": "n", "declarative_name": self._DN, "description": "B newest"},
                    ],
                },
            ]
        }
        older = {
            "libraries": [
                {
                    "name": "lib-a",
                    "configurations": [
                        {"name": "n", "declarative_name": self._DN, "description": "A old"},
                    ],
                },
                {
                    "name": "lib-b",
                    "configurations": [
                        {"name": "n", "declarative_name": self._DN, "description": "B old"},
                    ],
                },
            ]
        }

        normalize_config_descriptions([newest, older])

        assert older["libraries"][0]["configurations"][0]["description"] == "A newest"
        assert older["libraries"][1]["configurations"][0]["description"] == "B newest"

    def test_returns_same_list_and_handles_empty(self):
        inventories: list = []
        assert normalize_config_descriptions(inventories) is inventories


class TestBackfillUnderdocumentedConfigs:
    _DN = "java.common.http.client.url_template_rules"

    def _lib(self, name, has_config):
        configs = []
        if has_config:
            configs.append(
                {
                    "name": self._DN,
                    "declarative_name": self._DN,
                    "type": "list",
                    "default": "",
                }
            )
        return {"name": name, "configurations": configs}

    def test_backfills_config_into_earlier_version(self):
        """A config present only in the newest version is injected into earlier versions."""
        newest = {"libraries": [self._lib("apache-httpasyncclient-4.1", has_config=True)]}
        older = {"libraries": [self._lib("apache-httpasyncclient-4.1", has_config=False)]}

        backfill_underdocumented_configs([(Version("2.29.1"), newest), (Version("2.29.0"), older)])

        older_configs = older["libraries"][0]["configurations"]
        assert [c["declarative_name"] for c in older_configs] == [self._DN]
        # Injected config is an independent deep copy, not the template object.
        assert older_configs[0] is not newest["libraries"][0]["configurations"][0]

    def test_does_not_duplicate_when_already_present(self):
        """A version that already carries the config is left untouched."""
        newest = {"libraries": [self._lib("lib", has_config=True)]}
        older = {"libraries": [self._lib("lib", has_config=True)]}

        backfill_underdocumented_configs([(Version("2.29.1"), newest), (Version("2.29.0"), older)])

        assert len(older["libraries"][0]["configurations"]) == 1

    def test_does_not_add_to_instrumentation_absent_from_older_version(self):
        """Only instrumentations already present in the older version receive the config."""
        newest = {"libraries": [self._lib("new-lib", has_config=True)]}
        older = {"libraries": [self._lib("other-lib", has_config=False)]}

        backfill_underdocumented_configs([(Version("2.29.1"), newest), (Version("2.29.0"), older)])

        # other-lib doesn't carry the config in the newest version, so it isn't a template target.
        assert older["libraries"][0]["configurations"] == []
        assert len(older["libraries"]) == 1
