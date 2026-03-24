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
"""Tests for schema resolver."""

import pytest
from explorer_db_builder.schema_resolver import SchemaResolver


class TestResolveInternalRefs:
    def test_resolve_internal_ref(self):
        registry = {
            "root.yaml": {
                "type": "object",
                "properties": {
                    "foo": {"$ref": "#/$defs/Foo"},
                },
                "$defs": {
                    "Foo": {"type": "string", "description": "A foo"},
                },
            }
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["foo"] == {
            "type": "string",
            "description": "A foo",
        }

    def test_resolve_internal_ref_nested_path(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "bar": {"$ref": "#/$defs/Nested/properties/inner"},
                },
                "$defs": {
                    "Nested": {
                        "properties": {
                            "inner": {"type": "integer"},
                        },
                    },
                },
            }
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["bar"] == {"type": "integer"}

    def test_resolve_internal_ref_not_found(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "foo": {"$ref": "#/$defs/Missing"},
                },
                "$defs": {},
            }
        }
        resolver = SchemaResolver(registry)

        with pytest.raises(KeyError, match="Missing"):
            resolver.resolve("root.yaml")
