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

import json
from pathlib import Path

import pytest
import yaml
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


class TestResolveCrossFileRefs:
    def test_resolve_cross_file_whole(self):
        registry = {
            "root.yaml": {
                "$defs": {
                    "Other": {"$ref": "other.yaml"},
                },
                "properties": {
                    "x": {"$ref": "#/$defs/Other"},
                },
            },
            "other.yaml": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["x"] == {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
            },
        }

    def test_resolve_cross_file_with_path(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "encoding": {"$ref": "common.yaml#/$defs/Encoding"},
                },
            },
            "common.yaml": {
                "$defs": {
                    "Encoding": {
                        "type": "string",
                        "enum": ["json", "protobuf"],
                    },
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["encoding"] == {
            "type": "string",
            "enum": ["json", "protobuf"],
        }

    def test_resolve_cross_file_not_found(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "x": {"$ref": "missing.yaml"},
                },
            },
        }
        resolver = SchemaResolver(registry)

        with pytest.raises(KeyError, match="missing.yaml"):
            resolver.resolve("root.yaml")

    def test_resolve_cross_file_chain(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "exporter": {"$ref": "exporter.yaml"},
                },
            },
            "exporter.yaml": {
                "type": "object",
                "properties": {
                    "endpoint": {"$ref": "common.yaml#/$defs/Endpoint"},
                },
            },
            "common.yaml": {
                "$defs": {
                    "Endpoint": {"type": "string", "description": "URL"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["exporter"]["properties"]["endpoint"] == {
            "type": "string",
            "description": "URL",
        }


class TestSiblingMerging:
    def test_sibling_properties_override_ref(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "log_level": {
                        "$ref": "common.yaml#/$defs/Severity",
                        "description": "Override description",
                        "defaultBehavior": "INFO is used",
                    },
                },
            },
            "common.yaml": {
                "$defs": {
                    "Severity": {
                        "type": "string",
                        "description": "Original description",
                        "enum": ["debug", "info", "warn", "error"],
                    },
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        log_level = result["properties"]["log_level"]
        assert log_level["description"] == "Override description"
        assert log_level["defaultBehavior"] == "INFO is used"
        assert log_level["type"] == "string"
        assert log_level["enum"] == ["debug", "info", "warn", "error"]

    def test_non_dict_ref_ignores_siblings(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "x": {
                        "$ref": "#/$defs/Val",
                        "description": "ignored",
                    },
                },
                "$defs": {
                    "Val": "plain_string_value",
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["x"] == "plain_string_value"

    def test_ref_only_no_siblings(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "foo": {"$ref": "#/$defs/Foo"},
                },
                "$defs": {
                    "Foo": {"type": "integer", "minimum": 0},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["foo"] == {"type": "integer", "minimum": 0}


class TestCircularRefDetection:
    def test_direct_self_reference(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "self": {"$ref": "#/$defs/A"},
                },
                "$defs": {
                    "A": {
                        "type": "object",
                        "properties": {
                            "nested": {"$ref": "#/$defs/A"},
                        },
                    },
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["self"]["properties"]["nested"] == {"$circular_ref": "#/$defs/A"}

    def test_indirect_cycle(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "start": {"$ref": "#/$defs/A"},
                },
                "$defs": {
                    "A": {
                        "type": "object",
                        "properties": {
                            "b": {"$ref": "#/$defs/B"},
                        },
                    },
                    "B": {
                        "type": "object",
                        "properties": {
                            "a": {"$ref": "#/$defs/A"},
                        },
                    },
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["start"]["properties"]["b"]["properties"]["a"] == {"$circular_ref": "#/$defs/A"}

    def test_cross_file_circular_ref(self):
        registry = {
            "root.yaml": {
                "properties": {
                    "x": {"$ref": "a.yaml"},
                },
            },
            "a.yaml": {
                "type": "object",
                "properties": {
                    "y": {"$ref": "b.yaml"},
                },
            },
            "b.yaml": {
                "type": "object",
                "properties": {
                    "z": {"$ref": "a.yaml"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["properties"]["x"]["properties"]["y"]["properties"]["z"] == {"$circular_ref": "a.yaml"}

    def test_sampler_like_cycle(self):
        """Simulates the real Sampler -> ParentBased -> root -> Sampler cycle."""
        registry = {
            "root.yaml": {
                "properties": {
                    "sampler": {"$ref": "#/$defs/Sampler"},
                },
                "$defs": {
                    "Sampler": {
                        "type": "object",
                        "properties": {
                            "parent_based": {"$ref": "#/$defs/ParentBasedSampler"},
                        },
                    },
                    "ParentBasedSampler": {
                        "type": "object",
                        "properties": {
                            "root": {
                                "$ref": "#/$defs/Sampler",
                                "description": "Sampler for root spans",
                            },
                        },
                    },
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        root_sampler = result["properties"]["sampler"]["properties"]["parent_based"]["properties"]["root"]
        assert root_sampler["$circular_ref"] == "#/$defs/Sampler"
        assert root_sampler["description"] == "Sampler for root spans"


class TestDefsStripping:
    def test_top_level_defs_stripped(self):
        registry = {
            "root.yaml": {
                "type": "object",
                "properties": {
                    "x": {"$ref": "#/$defs/X"},
                },
                "$defs": {
                    "X": {"type": "string"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert "$defs" not in result

    def test_nested_defs_stripped(self):
        registry = {
            "root.yaml": {
                "$defs": {
                    "Other": {"$ref": "other.yaml"},
                },
                "properties": {
                    "x": {"$ref": "#/$defs/Other"},
                },
            },
            "other.yaml": {
                "type": "object",
                "properties": {
                    "y": {"$ref": "#/$defs/Inner"},
                },
                "$defs": {
                    "Inner": {"type": "number"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert "$defs" not in result
        assert "$defs" not in result["properties"]["x"]

    def test_non_defs_keys_preserved(self):
        registry = {
            "root.yaml": {
                "type": "object",
                "additionalProperties": True,
                "description": "Root",
                "properties": {
                    "a": {"type": "string"},
                },
                "$defs": {
                    "Unused": {"type": "integer"},
                },
            },
        }
        resolver = SchemaResolver(registry)
        result = resolver.resolve("root.yaml")

        assert result["type"] == "object"
        assert result["additionalProperties"] is True
        assert result["description"] == "Root"
        assert result["properties"]["a"] == {"type": "string"}
        assert "$defs" not in result


class TestIntegrationWithRealSchemas:
    SCHEMA_DIR = Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0"

    @pytest.mark.skipif(
        not (Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0").exists(),
        reason="Real schema files not available",
    )
    def test_resolve_real_v1_schema(self):
        registry = {}
        for yaml_file in sorted(self.SCHEMA_DIR.glob("*.yaml")):
            with open(yaml_file) as f:
                registry[yaml_file.name] = yaml.safe_load(f)

        resolver = SchemaResolver(registry)
        result = resolver.resolve("opentelemetry_configuration.yaml")

        assert result["type"] == "object"
        assert "properties" in result
        assert "$defs" not in result
        assert "file_format" in result["properties"]
        assert "tracer_provider" in result["properties"]
        assert "meter_provider" in result["properties"]
        assert "propagator" in result["properties"]

        # Refs resolved, not left as $ref strings
        propagator = result["properties"]["propagator"]
        assert "$ref" not in propagator
        assert "properties" in propagator or "type" in propagator

        # Sampler has known cycles
        tracer = result["properties"]["tracer_provider"]
        sampler = tracer["properties"]["sampler"]
        parent_based = sampler["properties"]["parent_based"]
        root_sampler = parent_based["properties"]["root"]
        assert "$circular_ref" in root_sampler

    @pytest.mark.skipif(
        not (Path(__file__).parent.parent.parent.parent / "ecosystem-registry" / "configuration" / "v1.0.0").exists(),
        reason="Real schema files not available",
    )
    def test_resolved_schema_serializes_to_json(self):
        registry = {}
        for yaml_file in sorted(self.SCHEMA_DIR.glob("*.yaml")):
            with open(yaml_file) as f:
                registry[yaml_file.name] = yaml.safe_load(f)

        resolver = SchemaResolver(registry)
        result = resolver.resolve("opentelemetry_configuration.yaml")

        json_str = json.dumps(result, indent=2, sort_keys=True)
        assert len(json_str) > 1000
