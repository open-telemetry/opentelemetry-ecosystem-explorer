"""Tests for instrumentation transformer."""

import pytest
from explorer_db_builder.instrumentation_transformer import (
    _transform_0_1_to_0_2,
    transform_instrumentation_format,
)


class TestTransformInstrumentationFormat:
    def test_format_0_2_no_transformation(self):
        """Format 0.2 data is returned unchanged."""
        data = {
            "file_format": 0.2,
            "libraries": [
                {
                    "name": "test-lib",
                    "javaagent_target_versions": ["com.test:lib:[1.0,)"],
                    "has_standalone_library": True,
                }
            ],
        }

        result = transform_instrumentation_format(data)

        assert result == data
        assert result["file_format"] == 0.2

    def test_format_0_1_transforms_to_0_2(self):
        """Format 0.1 data is transformed to 0.2."""
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

        assert result["file_format"] == 0.2
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
        data = {"file_format": 0.3, "libraries": []}

        with pytest.raises(ValueError, match="Unsupported file format: 0.3"):
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
