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

from explorer_db_builder.schema_ui_mapper import _classify_node, _extract_type_info, _generate_label


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
