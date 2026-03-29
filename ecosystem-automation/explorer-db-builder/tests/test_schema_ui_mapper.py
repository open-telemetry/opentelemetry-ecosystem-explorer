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
"""Tests for schema UI mapper."""

import json
from pathlib import Path

import pytest
import yaml
from explorer_db_builder.schema_ui_mapper import (
    _classify_node,
    _extract_type_info,
    _generate_label,
    map_schema_to_ui_tree,
)


class TestExtractTypeInfo:
    def test_nullable_integer(self):
        assert _extract_type_info({"type": ["integer", "null"]}) == ("integer", True)

    def test_nullable_string(self):
        assert _extract_type_info({"type": ["string", "null"]}) == ("string", True)

    def test_nullable_object(self):
        assert _extract_type_info({"type": ["object", "null"]}) == ("object", True)

    def test_plain_string(self):
        assert _extract_type_info({"type": "string"}) == ("string", False)

    def test_plain_object(self):
        assert _extract_type_info({"type": "object"}) == ("object", False)

    def test_single_element_array(self):
        assert _extract_type_info({"type": ["object"]}) == ("object", False)

    def test_no_type(self):
        assert _extract_type_info({}) == (None, False)


class TestGenerateLabel:
    def test_snake_case(self):
        assert _generate_label("attribute_count_limit") == "Attribute Count Limit"

    def test_single_word(self):
        assert _generate_label("disabled") == "Disabled"

    def test_development_suffix(self):
        assert _generate_label("instrumentation/development") == "Instrumentation"

    def test_development_suffix_multi_word(self):
        assert _generate_label("tracer_configurator/development") == "Tracer Configurator"

    def test_no_development_suffix(self):
        assert _generate_label("file_format") == "File Format"


class TestClassifyNode:
    def test_circular_ref(self):
        node = {"$circular_ref": "#/$defs/Sampler", "description": "root sampler"}
        assert _classify_node(node) == "circular_ref"

    def test_union(self):
        node = {"oneOf": [{"type": "string"}, {"type": "integer"}]}
        assert _classify_node(node) == "union"

    def test_plugin_select_with_extension(self):
        node = {
            "type": "object",
            "isSdkExtensionPlugin": True,
            "minProperties": 1,
            "maxProperties": 1,
            "properties": {"always_on": {}},
        }
        assert _classify_node(node) == "plugin_select"

    def test_plugin_select_without_extension(self):
        node = {
            "type": "object",
            "minProperties": 1,
            "maxProperties": 1,
            "properties": {"explicit_bucket_histogram": {}},
        }
        assert _classify_node(node) == "plugin_select"

    def test_enum(self):
        node = {"type": ["string", "null"], "enum": ["debug", "info", "warn"]}
        assert _classify_node(node) == "select"

    def test_array_of_objects(self):
        node = {"type": "array", "items": {"type": "object", "properties": {"name": {}}}}
        assert _classify_node(node) == "list"

    def test_array_of_strings(self):
        node = {"type": "array", "items": {"type": "string"}}
        assert _classify_node(node) == "string_list"

    def test_array_of_numbers(self):
        node = {"type": "array", "items": {"type": "number"}}
        assert _classify_node(node) == "number_list"

    def test_key_value_map(self):
        node = {"type": "object", "additionalProperties": {"type": "object"}}
        assert _classify_node(node) == "key_value_map"

    def test_group(self):
        node = {
            "type": "object",
            "additionalProperties": False,
            "properties": {"endpoint": {"type": "string"}},
        }
        assert _classify_node(node) == "group"

    def test_flag(self):
        node = {"type": ["object", "null"], "additionalProperties": False}
        assert _classify_node(node) == "flag"

    def test_toggle(self):
        node = {"type": ["boolean", "null"]}
        assert _classify_node(node) == "toggle"

    def test_number_input_integer(self):
        node = {"type": ["integer", "null"], "minimum": 0}
        assert _classify_node(node) == "number_input"

    def test_number_input_number(self):
        node = {"type": ["number", "null"], "minimum": 0, "maximum": 1}
        assert _classify_node(node) == "number_input"

    def test_text_input(self):
        node = {"type": ["string", "null"]}
        assert _classify_node(node) == "text_input"

    def test_text_input_plain(self):
        node = {"type": "string"}
        assert _classify_node(node) == "text_input"


class TestClassifyNodePriority:
    def test_extension_plugin_beats_min_max_properties(self):
        """isSdkExtensionPlugin takes priority over min/maxProperties."""
        node = {
            "type": "object",
            "isSdkExtensionPlugin": True,
            "minProperties": 1,
            "maxProperties": 1,
            "properties": {"a": {}},
        }
        assert _classify_node(node) == "plugin_select"

    def test_distribution_is_key_value_map(self):
        """minProperties without maxProperties is not plugin_select."""
        node = {
            "type": "object",
            "additionalProperties": {"type": "object"},
            "minProperties": 1,
        }
        assert _classify_node(node) == "key_value_map"

    def test_enum_beats_text_input(self):
        node = {"type": ["string", "null"], "enum": ["a", "b"]}
        assert _classify_node(node) == "select"


class TestMapSchemaToUiTree:
    def test_root_is_group(self):
        schema = {
            "type": "object",
            "properties": {
                "disabled": {"type": ["boolean", "null"], "description": "Disable SDK."},
            },
        }
        result = map_schema_to_ui_tree(schema)
        assert result["controlType"] == "group"
        assert result["key"] == "root"
        assert result["path"] == ""
        assert len(result["children"]) == 1

    def test_leaf_node_fields(self):
        schema = {
            "type": "object",
            "properties": {
                "timeout": {
                    "type": ["integer", "null"],
                    "minimum": 0,
                    "description": "Max wait time.",
                    "defaultBehavior": "10000 is used",
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        timeout = result["children"][0]
        assert timeout["controlType"] == "number_input"
        assert timeout["key"] == "timeout"
        assert timeout["path"] == "timeout"
        assert timeout["label"] == "Timeout"
        assert timeout["description"] == "Max wait time."
        assert timeout["defaultBehavior"] == "10000 is used"
        assert timeout["nullable"] is True
        assert "required" not in timeout
        assert timeout["constraints"] == {"minimum": 0}

    def test_required_field(self):
        schema = {
            "type": "object",
            "required": ["file_format"],
            "properties": {
                "file_format": {"type": "string"},
                "disabled": {"type": ["boolean", "null"]},
            },
        }
        result = map_schema_to_ui_tree(schema)
        children = {c["key"]: c for c in result["children"]}
        assert children["file_format"]["required"] is True
        assert "required" not in children["disabled"]

    def test_nullable_absent_when_not_nullable(self):
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
            },
        }
        result = map_schema_to_ui_tree(schema)
        assert "nullable" not in result["children"][0]

    def test_group_with_additional_properties(self):
        schema = {
            "type": "object",
            "properties": {
                "resource": {
                    "type": "object",
                    "properties": {
                        "schema_url": {"type": ["string", "null"]},
                    },
                    "additionalProperties": {"type": "string"},
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        resource = result["children"][0]
        assert resource["controlType"] == "group"
        assert resource["allowAdditional"] is True

    def test_nested_group(self):
        schema = {
            "type": "object",
            "properties": {
                "limits": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "count": {"type": ["integer", "null"], "minimum": 0},
                    },
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        limits = result["children"][0]
        assert limits["controlType"] == "group"
        assert limits["path"] == "limits"
        count = limits["children"][0]
        assert count["path"] == "limits.count"
        assert count["controlType"] == "number_input"

    def test_plugin_select_with_options(self):
        schema = {
            "type": "object",
            "properties": {
                "sampler": {
                    "type": "object",
                    "isSdkExtensionPlugin": True,
                    "minProperties": 1,
                    "maxProperties": 1,
                    "additionalProperties": {"type": ["object", "null"]},
                    "properties": {
                        "always_on": {"type": ["object", "null"], "additionalProperties": False},
                        "trace_id_ratio_based": {
                            "type": ["object", "null"],
                            "additionalProperties": False,
                            "properties": {
                                "ratio": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                            },
                        },
                    },
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        sampler = result["children"][0]
        assert sampler["controlType"] == "plugin_select"
        assert sampler["allowCustom"] is True
        assert len(sampler["options"]) == 2
        options = {o["key"]: o for o in sampler["options"]}
        assert options["always_on"]["controlType"] == "flag"
        assert options["trace_id_ratio_based"]["controlType"] == "group"

    def test_select_with_enum_descriptions(self):
        schema = {
            "type": "object",
            "properties": {
                "encoding": {
                    "type": ["string", "null"],
                    "enum": ["protobuf", "json"],
                    "enumDescriptions": {
                        "protobuf": "Binary encoding.",
                        "json": "JSON encoding.",
                    },
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        encoding = result["children"][0]
        assert encoding["controlType"] == "select"
        assert encoding["enumOptions"] == [
            {"value": "protobuf", "description": "Binary encoding."},
            {"value": "json", "description": "JSON encoding."},
        ]

    def test_circular_ref(self):
        schema = {
            "type": "object",
            "properties": {
                "root_sampler": {
                    "$circular_ref": "#/$defs/Sampler",
                    "description": "Root sampler.",
                    "defaultBehavior": "always_on is used",
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        node = result["children"][0]
        assert node["controlType"] == "circular_ref"
        assert node["refType"] == "Sampler"
        assert node["description"] == "Root sampler."

    def test_development_stability(self):
        schema = {
            "type": "object",
            "properties": {
                "instrumentation/development": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"general": {"type": "object", "properties": {}}},
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        node = result["children"][0]
        assert node["key"] == "instrumentation/development"
        assert node["label"] == "Instrumentation"
        assert node["stability"] == "development"

    def test_array_list_with_item_schema(self):
        schema = {
            "type": "object",
            "properties": {
                "processors": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "isSdkExtensionPlugin": True,
                        "minProperties": 1,
                        "maxProperties": 1,
                        "properties": {"batch": {"type": ["object", "null"]}},
                    },
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        processors = result["children"][0]
        assert processors["controlType"] == "list"
        assert processors["itemSchema"]["controlType"] == "plugin_select"

    def test_constraints_exclusive(self):
        schema = {
            "type": "object",
            "properties": {
                "value": {
                    "type": ["number", "null"],
                    "exclusiveMinimum": 0,
                    "maximum": 100,
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        node = result["children"][0]
        assert node["constraints"] == {"exclusiveMinimum": 0, "maximum": 100}

    def test_null_behavior_passed_through(self):
        schema = {
            "type": "object",
            "properties": {
                "value": {
                    "type": ["string", "null"],
                    "nullBehavior": "dependent on usage context",
                },
            },
        }
        result = map_schema_to_ui_tree(schema)
        node = result["children"][0]
        assert node["nullBehavior"] == "dependent on usage context"


class TestIntegrationWithRealSchemas:
    SCHEMA_DIR = Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0"

    @pytest.mark.skipif(
        not (Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0").exists(),
        reason="Real schema files not available",
    )
    def test_map_real_v1_schema(self):
        from explorer_db_builder.schema_resolver import SchemaResolver

        registry = {}
        for yaml_file in sorted(self.SCHEMA_DIR.glob("*.yaml")):
            with open(yaml_file) as f:
                registry[yaml_file.name] = yaml.safe_load(f)

        resolver = SchemaResolver(registry)
        resolved = resolver.resolve("opentelemetry_configuration.yaml")
        result = map_schema_to_ui_tree(resolved)

        # Root structure
        assert result["controlType"] == "group"
        assert result["key"] == "root"
        assert result["path"] == ""

        children_keys = [c["key"] for c in result["children"]]
        assert "file_format" in children_keys
        assert "tracer_provider" in children_keys
        assert "meter_provider" in children_keys
        assert "propagator" in children_keys
        assert "resource" in children_keys

        # tracer_provider is a group with children
        tracer = next(c for c in result["children"] if c["key"] == "tracer_provider")
        assert tracer["controlType"] == "group"
        tracer_child_keys = [c["key"] for c in tracer["children"]]
        assert "sampler" in tracer_child_keys
        assert "processors" in tracer_child_keys

        # sampler is a plugin_select
        sampler = next(c for c in tracer["children"] if c["key"] == "sampler")
        assert sampler["controlType"] == "plugin_select"
        assert sampler["allowCustom"] is True
        option_keys = [o["key"] for o in sampler["options"]]
        assert "always_on" in option_keys
        assert "parent_based" in option_keys

        # parent_based has circular ref for root
        parent_based = next(o for o in sampler["options"] if o["key"] == "parent_based")
        pb_child_keys = [c["key"] for c in parent_based.get("children", [])]
        assert "root" in pb_child_keys
        root_sampler = next(c for c in parent_based["children"] if c["key"] == "root")
        assert root_sampler["controlType"] == "circular_ref"
        assert root_sampler["refType"] == "Sampler"

        # processors is a list
        processors = next(c for c in tracer["children"] if c["key"] == "processors")
        assert processors["controlType"] == "list"

    @pytest.mark.skipif(
        not (Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0").exists(),
        reason="Real schema files not available",
    )
    def test_mapped_schema_serializes_to_json(self):
        from explorer_db_builder.schema_resolver import SchemaResolver

        registry = {}
        for yaml_file in sorted(self.SCHEMA_DIR.glob("*.yaml")):
            with open(yaml_file) as f:
                registry[yaml_file.name] = yaml.safe_load(f)

        resolver = SchemaResolver(registry)
        resolved = resolver.resolve("opentelemetry_configuration.yaml")
        result = map_schema_to_ui_tree(resolved)

        json_str = json.dumps(result, indent=2, sort_keys=True)
        assert len(json_str) > 1000
