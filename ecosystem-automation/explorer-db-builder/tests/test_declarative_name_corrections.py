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
)


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
