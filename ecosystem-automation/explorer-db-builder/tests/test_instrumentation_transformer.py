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
    _collect_search_terms,
    _strip_version_range,
    _transform_0_1_to_0_2,
    make_index_instrumentation,
    make_list_instrumentation,
    transform_instrumentation_format,
)


class TestMakeListInstrumentation:
    def test_collapses_telemetry_to_flags_and_drops_heavy_telemetry(self):
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
        }

        entry = make_list_instrumentation(instrumentation, is_custom=False)

        # Presence flags precomputed from telemetry; the heavy telemetry array dropped.
        assert entry["has_spans"] is True
        assert entry["has_metrics"] is False
        assert "telemetry" not in entry
        assert entry["_is_custom"] is False
        # Fields the list page reads are preserved.
        assert entry["name"] == "akka-actor-2.3"
        assert entry["semantic_conventions"] == ["messaging"]
        assert entry["scope"] == {"name": "io.opentelemetry.akka-actor-2.3"}

    def test_preserves_configurations_for_config_builder(self):
        # The Configuration Builder reads `configurations` off the slim list
        # entries to render per-module options. Dropping them showed "No
        # configurable options for this module" for every module once a bundle
        # existed (CI missed it because committed data has no bundle_hash yet).
        configs = [
            {
                "name": "otel.x",
                "declarative_name": "java.x",
                "description": "d",
                "type": "boolean",
                "default": True,
            }
        ]
        entry = make_list_instrumentation({"name": "akka-actor-2.3", "configurations": configs}, is_custom=False)

        assert entry["configurations"] == configs

    def test_preserves_disabled_by_default_for_config_builder(self):
        # The Configuration Builder derives each module's default enabled/disabled
        # state (and the initial customization toggle) from `disabled_by_default`.
        # Dropping it flipped default-disabled modules (e.g. dropwizard_metrics)
        # to "enabled by default" and inverted the YAML toggle.
        entry = make_list_instrumentation(
            {"name": "dropwizard-metrics-1.5", "disabled_by_default": True}, is_custom=False
        )

        assert entry["disabled_by_default"] is True

    def test_marks_custom_and_omits_absent_optional_fields(self):
        entry = make_list_instrumentation({"name": "my-custom"}, is_custom=True)

        assert entry["_is_custom"] is True
        assert entry["has_spans"] is False
        assert entry["has_metrics"] is False
        # Absent optional fields are omitted so the content hash stays stable.
        assert "display_name" not in entry
        assert "semantic_conventions" not in entry
        assert "configurations" not in entry
        assert "disabled_by_default" not in entry


class TestMakeIndexInstrumentation:
    @staticmethod
    def _full_instrumentation() -> dict:
        return {
            "name": "kafka-clients-2.6",
            "display_name": "Kafka Clients",
            "description": "Kafka client instrumentation",
            "has_standalone_library": True,
            "library_link": "https://kafka.apache.org",
            "source_path": "instrumentation/kafka/kafka-clients-2.6",
            "minimum_java_version": 8,
            "scope": {"name": "io.opentelemetry.kafka-clients-2.6", "schema_url": "https://x/1.0"},
            "semantic_conventions": ["messaging"],
            "features": ["TRACING", "METRICS"],
            "javaagent_target_versions": ["org.apache.kafka:kafka-clients:[2.6,)"],
            "configurations": [
                {
                    "name": "otel.instrumentation.kafka.experimental-span-attributes",
                    "declarative_name": "experimental_span_attributes",
                    "description": "Enable experimental span attributes",
                    "type": "boolean",
                    "default": False,
                    "examples": ["true"],
                }
            ],
            "telemetry": [
                {
                    "when": "on publish",
                    "metrics": [
                        {
                            "name": "messaging.publish.duration",
                            "description": "Publish duration.",
                            "instrument": "histogram",
                            "data_type": "HISTOGRAM",
                            "unit": "s",
                            "attributes": [{"name": "messaging.system", "type": "STRING"}],
                        }
                    ],
                    "spans": [
                        {"span_kind": "PRODUCER", "attributes": [{"name": "messaging.system", "type": "STRING"}]}
                    ],
                }
            ],
        }

    def test_collects_distinctive_identifiers(self):
        terms = _collect_search_terms(self._full_instrumentation())
        for expected in [
            "io.opentelemetry.kafka-clients-2.6",  # scope.name
            "messaging",  # semantic convention
            "TRACING",
            "METRICS",
            "org.apache.kafka:kafka-clients",  # maven coordinate, version range stripped
            "otel.instrumentation.kafka.experimental-span-attributes",  # config name
            "experimental_span_attributes",  # config declarative_name
            "Enable experimental span attributes",  # config description
            "messaging.publish.duration",  # metric name
            "Publish duration.",  # metric description
        ]:
            assert expected in terms

    def test_excludes_low_signal_and_seeded_fields(self):
        # Noise (attributes, instrument/unit/data_type, span kind, link/path) is
        # dropped; name/display_name/description are re-indexed by the frontend.
        terms = _collect_search_terms(self._full_instrumentation())
        for excluded in [
            "https://kafka.apache.org",  # library_link
            "instrumentation/kafka/kafka-clients-2.6",  # source_path
            "8",  # minimum_java_version
            "https://x/1.0",  # scope.schema_url
            "on publish",  # telemetry.when
            "histogram",  # metric instrument
            "HISTOGRAM",  # metric data_type
            "s",  # metric unit
            "messaging.system",  # attribute name
            "STRING",  # attribute type
            "PRODUCER",  # span kind
            "org.apache.kafka:kafka-clients:[2.6,)",  # unstripped coordinate
            "kafka-clients-2.6",
            "Kafka Clients",
            "Kafka client instrumentation",
        ]:
            assert excluded not in terms

    def test_sorted_deduped_and_deterministic(self):
        a = self._full_instrumentation()
        b = self._full_instrumentation()
        b["features"] = list(reversed(b["features"]))
        # Two coordinates that strip to the same group:artifact must dedupe to one.
        b["javaagent_target_versions"] = [
            "org.apache.kafka:kafka-clients:[2.6,)",
            "org.apache.kafka:kafka-clients:[3.0,)",
        ]
        terms = _collect_search_terms(a)
        assert terms == sorted(set(terms))
        b_terms = _collect_search_terms(b)
        assert b_terms.count("org.apache.kafka:kafka-clients") == 1
        assert _collect_search_terms(a) == b_terms

    def test_null_safe_on_missing_optional_blocks(self):
        # No scope, no telemetry, no version metadata -> empty list, never a crash.
        assert _collect_search_terms({"name": "bare-1.0"}) == []
        assert _collect_search_terms({"name": "x", "scope": None, "telemetry": None}) == []

    def test_make_index_carries_lightweight_fields_and_search_terms(self):
        entry = make_index_instrumentation(self._full_instrumentation())
        assert entry["name"] == "kafka-clients-2.6"
        assert entry["display_name"] == "Kafka Clients"
        assert entry["description"] == "Kafka client instrumentation"
        assert entry["has_telemetry"] is True
        assert entry["has_standalone_library"] is True
        assert "messaging.publish.duration" in entry["search_terms"]
        # Heavy objects must not leak into the index entry.
        assert "configurations" not in entry
        assert "scope" not in entry
        assert "telemetry" not in entry

    def test_make_index_no_telemetry_yields_empty_search_terms(self):
        entry = make_index_instrumentation({"name": "bare-1.0"})
        assert entry["has_telemetry"] is False
        assert entry["search_terms"] == []

    def test_strip_version_range(self):
        assert _strip_version_range("org.springframework:spring-webmvc:[6.0.0,)") == "org.springframework:spring-webmvc"
        # Non-coordinate strings (no group:artifact:range shape) are unchanged.
        assert _strip_version_range("Java 8+") == "Java 8+"


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
