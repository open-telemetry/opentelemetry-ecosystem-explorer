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
"""Tests for instrumentation transformer."""

import pytest
from explorer_db_builder.instrumentation_transformer import (
    _transform_0_1_to_0_2,
    make_list_instrumentation,
    transform_instrumentation_format,
)


class TestMakeListInstrumentation:
    def test_collapses_telemetry_to_flags_and_drops_heavy_fields(self):
        instrumentation = {
            "name": "akka-actor-2.3",
            "display_name": "Akka Actor",
            "description": "Akka actor instrumentation",
            "scope": {"name": "io.opentelemetry.akka-actor-2.3"},
            "has_javaagent": True,
            "has_standalone_library": False,
            "semantic_conventions": ["messaging"],
            "features": ["context-propagation"],
            "telemetry": [{"when": "always", "spans": [{"span_kind": "CLIENT"}], "metrics": []}],
            "configurations": [{"name": "otel.x", "description": "d", "type": "boolean", "default": True}],
        }

        entry = make_list_instrumentation(instrumentation, is_custom=False)

        # Presence flags precomputed from telemetry; heavy arrays dropped.
        assert entry["has_spans"] is True
        assert entry["has_metrics"] is False
        assert "telemetry" not in entry
        assert "configurations" not in entry
        assert entry["_is_custom"] is False
        # Fields the list page reads are preserved.
        assert entry["name"] == "akka-actor-2.3"
        assert entry["semantic_conventions"] == ["messaging"]
        assert entry["scope"] == {"name": "io.opentelemetry.akka-actor-2.3"}

    def test_marks_custom_and_omits_absent_optional_fields(self):
        entry = make_list_instrumentation({"name": "my-custom"}, is_custom=True)

        assert entry["_is_custom"] is True
        assert entry["has_spans"] is False
        assert entry["has_metrics"] is False
        # Absent optional fields are omitted so the content hash stays stable.
        assert "display_name" not in entry
        assert "semantic_conventions" not in entry


class TestTransformInstrumentationFormat:
    def test_format_0_5_no_transformation(self):
        """Format 0.5 data is returned unchanged."""
        data = {
            "file_format": 0.5,
            "libraries": [
                {
                    "name": "test-lib",
                    "javaagent_target_versions": ["com.test:lib:[1.0,)"],
                    "has_standalone_library": True,
                    "has_javaagent": True,
                    "configurations": [
                        {
                            "name": "otel.test.option",
                            "declarative_name": "java.test.option",
                            "type": "boolean",
                            "examples": ["true", "false"],
                        }
                    ],
                }
            ],
        }

        result = transform_instrumentation_format(data)

        assert result == data
        assert result["file_format"] == 0.5

    def test_format_0_3_transforms_to_0_5(self):
        """Format 0.3 data is transformed to 0.5 (version bump, structure preserved)."""
        data = {
            "file_format": 0.3,
            "libraries": [
                {
                    "name": "test-lib",
                    "javaagent_target_versions": ["com.test:lib:[1.0,)"],
                    "has_standalone_library": True,
                    "configurations": [{"name": "otel.test.option", "type": "boolean"}],
                }
            ],
        }

        result = transform_instrumentation_format(data)

        assert result["file_format"] == 0.5
        assert result["libraries"][0]["name"] == "test-lib"
        assert result["libraries"][0]["configurations"][0]["name"] == "otel.test.option"

    def test_format_0_2_transforms_to_0_5(self):
        """Format 0.2 data is transformed to 0.5."""
        data = {
            "file_format": 0.2,
            "libraries": [
                {
                    "name": "activej-http-6.0",
                    "display_name": "ActiveJ",
                    "description": "HTTP server instrumentation",
                    "semantic_conventions": ["HTTP_SERVER_SPANS"],
                    "library_link": "https://activej.io/",
                    "source_path": "instrumentation/activej-http-6.0",
                    "javaagent_target_versions": ["io.activej:activej-http:[6.0,)"],
                    "configurations": [],
                    "telemetry": [
                        {
                            "when": "default",
                            "metrics": [
                                {
                                    "name": "http.server.request.duration",
                                    "description": "Duration of HTTP server requests.",
                                    "type": "HISTOGRAM",
                                    "instrument": "histogram",
                                    "unit": "s",
                                }
                            ],
                            "spans": [{"span_kind": "SERVER"}],
                        }
                    ],
                }
            ],
        }

        result = transform_instrumentation_format(data)

        assert result["file_format"] == 0.5
        # Verify the type field was renamed to data_type in the metric
        metric = result["libraries"][0]["telemetry"][0]["metrics"][0]
        assert metric["data_type"] == "HISTOGRAM"
        assert metric["instrument"] == "histogram"
        assert "type" not in metric
        # Verify other fields are preserved
        assert result["libraries"][0]["name"] == "activej-http-6.0"
        assert result["libraries"][0]["display_name"] == "ActiveJ"
        assert result["libraries"][0]["javaagent_target_versions"] == ["io.activej:activej-http:[6.0,)"]

    def test_format_0_1_transforms_to_0_5(self):
        """Format 0.1 data is transformed through 0.2 and 0.3 to 0.5."""
        data = {
            "file_format": 0.1,
            "libraries": [
                {
                    "name": "test-lib",
                    "target_versions": {
                        "javaagent": ["com.test:lib:[1.0,)"],
                        "library": ["com.test:lib:1.0.0"],
                    },
                }
            ],
        }

        result = transform_instrumentation_format(data)

        assert result["file_format"] == 0.5
        assert result["libraries"][0]["javaagent_target_versions"] == ["com.test:lib:[1.0,)"]
        assert result["libraries"][0]["has_standalone_library"] is True
        assert "target_versions" not in result["libraries"][0]

    def test_missing_file_format_raises_error(self):
        """Missing file_format field raises ValueError."""
        data = {"libraries": [{"name": "test-lib"}]}

        with pytest.raises(ValueError, match="missing 'file_format' field"):
            transform_instrumentation_format(data)

    def test_unsupported_file_format_raises_error(self):
        """Unsupported file format raises ValueError."""
        data = {"file_format": 0.9, "libraries": []}

        with pytest.raises(ValueError, match="Unsupported file format: 0.9"):
            transform_instrumentation_format(data)


class TestTransform01To02:
    def test_transforms_javaagent_and_library_fields(self):
        """Transforms target_versions to new format with both javaagent and library."""
        data = {
            "file_format": 0.1,
            "libraries": [
                {
                    "name": "with-library",
                    "target_versions": {
                        "javaagent": ["com.alibaba:druid:(,)"],
                        "library": ["com.alibaba:druid:1.0.0"],
                    },
                },
                {
                    "name": "without-library",
                    "target_versions": {
                        "javaagent": ["io.activej:activej-http:[6.0,)"],
                    },
                },
                {
                    "name": "library-empty-array",
                    "target_versions": {
                        "javaagent": ["com.test:lib:[1.0,)"],
                        "library": [],
                    },
                },
            ],
        }

        result = _transform_0_1_to_0_2(data)

        assert result["file_format"] == 0.2

        # With library versions
        assert result["libraries"][0]["javaagent_target_versions"] == ["com.alibaba:druid:(,)"]
        assert result["libraries"][0]["has_standalone_library"] is True
        assert "target_versions" not in result["libraries"][0]

        # Without library versions
        assert result["libraries"][1]["javaagent_target_versions"] == ["io.activej:activej-http:[6.0,)"]
        assert result["libraries"][1]["has_standalone_library"] is False

        # With empty library array
        assert result["libraries"][2]["has_standalone_library"] is False

    def test_preserves_other_fields(self):
        """Preserves other library fields during transformation."""
        data = {
            "file_format": 0.1,
            "libraries": [
                {
                    "name": "test-lib",
                    "display_name": "Test Library",
                    "description": "A test library",
                    "library_link": "https://example.com",
                    "source_path": "instrumentation/test-lib",
                    "target_versions": {
                        "javaagent": ["com.test:lib:[1.0,)"],
                    },
                    "configurations": [{"name": "test.config", "type": "boolean"}],
                }
            ],
        }

        result = _transform_0_1_to_0_2(data)

        lib = result["libraries"][0]
        assert lib["name"] == "test-lib"
        assert lib["display_name"] == "Test Library"
        assert lib["description"] == "A test library"
        assert lib["library_link"] == "https://example.com"
        assert lib["source_path"] == "instrumentation/test-lib"
        assert lib["configurations"] == [{"name": "test.config", "type": "boolean"}]

    def test_handles_multiple_javaagent_versions(self):
        """Handles libraries with multiple javaagent target versions."""
        data = {
            "file_format": 0.1,
            "libraries": [
                {
                    "name": "akka-actor-2.3",
                    "target_versions": {
                        "javaagent": [
                            "com.typesafe.akka:akka-actor_2.11:[2.3,)",
                            "com.typesafe.akka:akka-actor_2.12:[2.3,)",
                            "com.typesafe.akka:akka-actor_2.13:[2.3,)",
                        ],
                    },
                }
            ],
        }

        result = _transform_0_1_to_0_2(data)

        lib = result["libraries"][0]
        assert len(lib["javaagent_target_versions"]) == 3
        assert lib["has_standalone_library"] is False

    def test_missing_libraries_key_raises_error(self):
        """Missing libraries key raises KeyError."""
        data = {"file_format": 0.1}

        with pytest.raises(KeyError, match="missing 'libraries' key"):
            _transform_0_1_to_0_2(data)

    def test_libraries_key_is_none_raises_error(self):
        """libraries key present but None also raises KeyError."""
        data = {"file_format": 0.1, "libraries": None}

        with pytest.raises(KeyError, match="missing 'libraries' key"):
            _transform_0_1_to_0_2(data)
