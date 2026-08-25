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
"""Tests for metadata parser."""

import shutil
import tempfile
from pathlib import Path

import pytest
from collector_watcher.metadata_parser import (
    MetadataParser,
    MetadataParserFactory,
    MetadataParserV1,
    parse_component_metadata,
)


@pytest.fixture
def temp_component_dir():
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


def create_metadata_file(component_dir: Path, content: str):
    metadata_path = component_dir / "metadata.yaml"
    metadata_path.write_text(content)
    return metadata_path


def test_parse_type_field(temp_component_dir):
    create_metadata_file(temp_component_dir, "type: otlp")
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata is not None
    assert metadata["type"] == "otlp"


def test_parse_status_basic(temp_component_dir):
    content = """
type: test
status:
  class: receiver
  distributions: [contrib, custom]
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata["status"]["class"] == "receiver"
    assert metadata["status"]["distributions"] == ["contrib", "custom"]


def test_parse_status_stability(temp_component_dir):
    content = """
type: test
status:
  class: receiver
  stability:
    stable: [metrics, traces]
    beta: [logs]
    alpha: [profiles]
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    stability = metadata["status"]["stability"]
    # Should be sorted alphabetically by level
    assert list(stability.keys()) == ["alpha", "beta", "stable"]
    # Signals within each level should be sorted
    assert stability["stable"] == ["metrics", "traces"]
    assert stability["beta"] == ["logs"]
    assert stability["alpha"] == ["profiles"]


def test_parse_status_unsupported_platforms(temp_component_dir):
    content = """
type: test
status:
  class: receiver
  unsupported_platforms: [windows, linux, darwin]
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    # Should be sorted
    assert metadata["status"]["unsupported_platforms"] == ["darwin", "linux", "windows"]


def test_parse_attributes_with_deterministic_ordering(temp_component_dir):
    content = """
type: test
attributes:
  zebra_attr:
    description: Last alphabetically
    type: string
  alpha_attr:
    description: First alphabetically
    type: int
  middle_attr:
    description: Middle alphabetically
    type: string
    enum: [z_value, a_value, m_value]
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    attrs = metadata["attributes"]
    # Attributes should be sorted by key
    assert list(attrs.keys()) == ["alpha_attr", "middle_attr", "zebra_attr"]
    # Enum values should be sorted
    assert attrs["middle_attr"]["enum"] == ["a_value", "m_value", "z_value"]


def test_parse_metrics_with_deterministic_ordering(temp_component_dir):
    content = """
type: test
metrics:
  system.cpu.usage:
    description: CPU usage
    unit: "%"
    enabled: true
    sum:
      monotonic: false
      aggregation_temporality: cumulative
      value_type: double
    attributes: [state, cpu]
  system.memory.usage:
    description: Memory usage
    unit: By
    enabled: true
    gauge:
      value_type: int
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    metrics = metadata["metrics"]
    # Metrics should be sorted by key
    assert list(metrics.keys()) == ["system.cpu.usage", "system.memory.usage"]
    # Metric attributes should be sorted
    assert metrics["system.cpu.usage"]["attributes"] == ["cpu", "state"]


def test_parse_resource_attributes(temp_component_dir):
    content = """
type: test
resource_attributes:
  host.name:
    description: Hostname
    type: string
  service.name:
    description: Service name
    type: string
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    res_attrs = metadata["resource_attributes"]
    assert list(res_attrs.keys()) == ["host.name", "service.name"]


def test_parse_malformed_yaml(temp_component_dir):
    content = """
type: test
status:
  class: receiver
  invalid: [unclosed list
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    # Should return None for malformed YAML
    assert metadata is None


def test_parse_empty_file(temp_component_dir):
    create_metadata_file(temp_component_dir, "")
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata is None


def test_deterministic_output(temp_component_dir):
    content = """
type: test
status:
  class: receiver
  stability:
    stable: [traces, metrics]
    beta: [logs]
attributes:
  z_attr:
    type: string
  a_attr:
    type: int
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)

    metadata1 = parser.parse()
    metadata2 = parser.parse()

    assert metadata1 == metadata2
    # Keys should be in the same order
    assert list(metadata1["attributes"].keys()) == list(metadata2["attributes"].keys())


def test_parse_complete_metadata(temp_component_dir):
    content = """
display_name: Active Directory DS Receiver
type: active_directory_ds
description: Receiver for Active Directory Domain Services replication data.
status:
  class: receiver
  stability:
    beta: [metrics]
  distributions: [contrib]
  codeowners:
    active: [pjanotti]
    seeking_new: true
  unsupported_platforms: [darwin, linux]
attributes:
  direction:
    description: The direction of data flow.
    type: string
    enum: [sent, received]
metrics:
  active_directory.ds.replication.network.io:
    description: Network data transmitted.
    unit: By
    sum:
      monotonic: true
      aggregation_temporality: cumulative
      value_type: int
    attributes: [direction]
    enabled: true
    stability:
      level: development
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata is not None
    assert metadata["display_name"] == "Active Directory DS Receiver"
    assert metadata["description"] == "Receiver for Active Directory Domain Services replication data."
    assert metadata["type"] == "active_directory_ds"
    assert metadata["status"]["class"] == "receiver"
    assert "direction" in metadata["attributes"]
    assert "active_directory.ds.replication.network.io" in metadata["metrics"]


def test_parse_memorylimiterprocessor_fixture_includes_telemetry(temp_component_dir):
    """A real-shaped metadata.yaml (mirroring opentelemetry-collector's
    memorylimiterprocessor) must retain its `telemetry` block through the
    full file-I/O path, not just the in-memory parser unit tests above."""
    content = """
display_name: Memory Limiter Processor
type: memory_limiter
github_project: open-telemetry/opentelemetry-collector

status:
  disable_codecov_badge: true
  class: processor
  stability:
    alpha: [profiles]
    beta: [traces, metrics, logs]
  distributions: [core, contrib, k8s]

tests:
  config:
    check_interval: 5s
    limit_mib: 400
    spike_limit_mib: 50

telemetry:
  metrics:
    processor_memory_limiter_accepted_log_records:
      enabled: true
      description: Number of log records successfully pushed into the next component in the pipeline.
      stability: alpha
      unit: "{record}"
      sum:
        value_type: int
        monotonic: true
    processor_memory_limiter_refused_spans:
      enabled: true
      description: Number of spans that were rejected by the next component in the pipeline.
      stability: alpha
      unit: "{span}"
      sum:
        value_type: int
        monotonic: true
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata is not None
    assert "telemetry" in metadata
    telemetry_metrics = metadata["telemetry"]["metrics"]
    assert set(telemetry_metrics.keys()) == {
        "processor_memory_limiter_accepted_log_records",
        "processor_memory_limiter_refused_spans",
    }
    assert telemetry_metrics["processor_memory_limiter_accepted_log_records"]["unit"] == "{record}"

    # Fields with no dedicated normalizer are preserved too, not just telemetry.
    assert metadata["github_project"] == "open-telemetry/opentelemetry-collector"
    assert metadata["status"]["class"] == "processor"

    # Excluded fields are dropped: `tests` entirely, `status.disable_codecov_badge` only.
    assert "tests" not in metadata
    assert "disable_codecov_badge" not in metadata["status"]


def test_has_metadata_returns_false_for_missing_file(temp_component_dir):
    """Test that has_metadata() returns False when metadata.yaml doesn't exist."""
    parser = MetadataParser(temp_component_dir)
    assert parser.has_metadata() is False


def test_parse_returns_none_for_missing_file(temp_component_dir):
    """Test that parse() returns None when metadata.yaml doesn't exist."""
    parser = MetadataParser(temp_component_dir)
    assert parser.parse() is None


def test_parse_with_logging_on_error(temp_component_dir, caplog):
    import logging

    content = """
type: test
status:
  class: receiver
  invalid: [unclosed list
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)

    with caplog.at_level(logging.WARNING):
        metadata = parser.parse()

    assert metadata is None
    assert len(caplog.records) == 1
    assert "Failed to parse" in caplog.text


def test_sanitize_description_whitespace_normalization(temp_component_dir):
    """Test line breaks, extra spaces, and tabs."""
    content = """
type: test
description: |
  The Delta to Cumulative Processor (`deltatocumulativeprocessor`) converts metrics from delta temporality to

  cumulative, by accumulating samples in memory.
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata is not None
    expected = (
        "The Delta to Cumulative Processor (`deltatocumulativeprocessor`) converts metrics "
        "from delta temporality to cumulative, by accumulating samples in memory."
    )
    assert metadata["description"] == expected
    assert "\n" not in metadata["description"]


def test_sanitize_descriptions_in_attributes_and_metrics(temp_component_dir):
    """Test sanitization applies to attribute, metric, and resource attribute descriptions."""
    content = """
type: test
attributes:
  test_attr:
    description: |
      Multi-line attribute description
      with line breaks.
    type: string
metrics:
  test.metric:
    description: |
      total number of datapoints processed. may have 'error' attribute,
      if processing failed
    unit: "{datapoint}"
    enabled: true
resource_attributes:
  service.name:
    description: |
      The name of the service
      running the collector.
    type: string
"""
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    metadata = parser.parse()

    assert metadata["attributes"]["test_attr"]["description"] == "Multi-line attribute description with line breaks."
    assert (
        metadata["metrics"]["test.metric"]["description"]
        == "total number of datapoints processed. may have 'error' attribute, if processing failed"
    )
    assert (
        metadata["resource_attributes"]["service.name"]["description"]
        == "The name of the service running the collector."
    )


# ---------------------------------------------------------------------------
# MetadataParserV1 — direct unit tests
# ---------------------------------------------------------------------------


def test_parser_v1_schema_version():
    assert MetadataParserV1().get_schema_version() == "v1"


def test_parser_v1_parse_returns_none_for_empty():
    assert MetadataParserV1().parse({}) is None
    assert MetadataParserV1().parse(None) is None  # type: ignore[arg-type]


def test_parser_v1_parse_type_field():
    result = MetadataParserV1().parse({"type": "otlp"})
    assert result is not None
    assert result["type"] == "otlp"


def test_parser_v1_parse_status():
    raw = {
        "type": "test",
        "status": {
            "class": "receiver",
            "stability": {"stable": ["metrics", "traces"], "beta": ["logs"]},
            "distributions": ["contrib", "core"],
        },
    }
    result = MetadataParserV1().parse(raw)
    assert result["status"]["class"] == "receiver"
    assert result["status"]["stability"]["stable"] == ["metrics", "traces"]
    assert result["status"]["distributions"] == ["contrib", "core"]


def test_parser_v1_sorted_attributes():
    raw = {
        "type": "test",
        "attributes": {
            "z_attr": {"type": "string"},
            "a_attr": {"type": "int"},
        },
    }
    result = MetadataParserV1().parse(raw)
    assert list(result["attributes"].keys()) == ["a_attr", "z_attr"]


def test_parser_v1_passes_through_unknown_top_level_fields():
    """Unknown fields (e.g. future schema additions) are preserved, not dropped."""
    raw = {"type": "test", "future_field": "some_value"}
    result = MetadataParserV1().parse(raw)
    assert result["future_field"] == "some_value"


def test_parser_v1_passes_through_known_but_unhandled_top_level_fields():
    """Fields that exist in the upstream schema today but have no dedicated
    normalizer (e.g. `sem_conv_version`, `config`) are preserved verbatim
    rather than requiring bespoke handling."""
    raw = {
        "type": "test",
        "sem_conv_version": "1.9.0",
        "config": {"type": "object", "properties": {}},
    }
    result = MetadataParserV1().parse(raw)
    assert result["sem_conv_version"] == "1.9.0"
    assert result["config"] == {"type": "object", "properties": {}}


def test_parser_v1_excludes_tests_node():
    """The `tests` node is dropped entirely rather than passed through,
    while other unknown fields are still preserved."""
    raw = {
        "type": "test",
        "tests": {"config": {"endpoint": "localhost:1234"}},
        "sem_conv_version": "1.9.0",
    }
    result = MetadataParserV1().parse(raw)
    assert "tests" not in result
    assert result["sem_conv_version"] == "1.9.0"


def test_parser_v1_excludes_dotted_nested_field():
    """A dotted-path entry in EXCLUDED_FIELDS (`status.disable_codecov_badge`)
    drops only that field from within the nested `status` object, leaving
    other `status` fields — including other previously-unhandled ones like
    `warnings`/`deprecation` — untouched."""
    raw = {
        "type": "test",
        "status": {
            "class": "processor",
            "disable_codecov_badge": True,
            "warnings": ["This component is unmaintained."],
            "deprecation": {"traces": {"date": "2026-01-01", "migration": "use X instead"}},
        },
    }
    result = MetadataParserV1().parse(raw)
    status = result["status"]
    assert "disable_codecov_badge" not in status
    assert status["class"] == "processor"
    assert status["warnings"] == ["This component is unmaintained."]
    assert status["deprecation"] == {"traces": {"date": "2026-01-01", "migration": "use X instead"}}


def test_parser_v1_dotted_exclusion_does_not_affect_same_key_at_top_level():
    """`status.disable_codecov_badge` only matches that key inside `status`;
    a top-level field with the same bare name is unaffected."""
    raw = {"type": "test", "disable_codecov_badge": True}
    result = MetadataParserV1().parse(raw)
    assert result["disable_codecov_badge"] is True


def test_parser_v1_output_keys_are_sorted():
    """Top-level parsed output keys are sorted alphabetically, independent
    of the source dict's insertion order, so the same logical content always
    serializes identically for the content-addressed registry."""
    raw_a = {"type": "test", "display_name": "Test", "description": "A component."}
    raw_b = {"description": "A component.", "display_name": "Test", "type": "test"}

    result_a = MetadataParserV1().parse(raw_a)
    result_b = MetadataParserV1().parse(raw_b)

    assert list(result_a.keys()) == sorted(result_a.keys())
    assert result_a == result_b
    assert list(result_a.keys()) == list(result_b.keys())


def test_parser_v1_nested_dict_keys_are_sorted():
    """Ordering determinism also applies to nested objects that mix
    dedicated normalization with passthrough fields: status and telemetry."""
    raw = {
        "type": "test",
        "status": {"distributions": ["core"], "class": "receiver", "codeowners": {"active": ["a"]}},
        "telemetry": {"future_telemetry_field": "value", "metrics": {}},
    }
    result = MetadataParserV1().parse(raw)
    assert list(result["status"].keys()) == sorted(result["status"].keys())
    assert list(result["telemetry"].keys()) == sorted(result["telemetry"].keys())


def test_parser_v1_attribute_and_metric_dict_keys_are_sorted():
    """Ordering determinism also applies within each attribute/metric entry."""
    raw = {
        "type": "test",
        "attributes": {"a": {"type": "string", "description": "d", "requirement_level": "required"}},
        "metrics": {"m": {"unit": "1", "description": "d", "gauge": {"value_type": "int"}, "stability": "beta"}},
    }
    result = MetadataParserV1().parse(raw)
    assert list(result["attributes"]["a"].keys()) == sorted(result["attributes"]["a"].keys())
    assert list(result["metrics"]["m"].keys()) == sorted(result["metrics"]["m"].keys())


def test_parser_v1_sorts_deeply_nested_passthrough_dicts():
    """Passthrough content with no dedicated normalizer of its own —
    `status.codeowners`, a metric's `sum`/`gauge`/`histogram` descriptor
    body, and arbitrarily-shaped `config` — is still key-sorted at every
    depth, not just one level in from its nearest `_merge_known_fields`
    call."""
    raw = {
        "type": "test",
        "status": {
            "class": "receiver",
            "codeowners": {"seeking_new": True, "active": ["z", "a"], "emeritus": []},
        },
        "metrics": {
            "m": {
                "description": "d",
                "unit": "1",
                "sum": {"monotonic": True, "aggregation_temporality": "cumulative", "value_type": "int"},
            }
        },
        "config": {
            "type": "object",
            "properties": {"z_field": {"type": "string"}, "a_field": {"type": "int", "default": 0}},
        },
    }
    result = MetadataParserV1().parse(raw)

    assert list(result["status"]["codeowners"].keys()) == sorted(result["status"]["codeowners"].keys())
    assert list(result["metrics"]["m"]["sum"].keys()) == sorted(result["metrics"]["m"]["sum"].keys())
    assert list(result["config"]["properties"].keys()) == sorted(result["config"]["properties"].keys())
    assert list(result["config"]["properties"]["a_field"].keys()) == sorted(
        result["config"]["properties"]["a_field"].keys()
    )


def test_parser_v1_sorts_dict_keys_inside_list_elements_without_reordering_the_list():
    """`entities` and `feature_gates` are lists of dicts with no dedicated
    normalizer. Recursive sorting must key-sort each dict *inside* the list
    without changing which element comes first — upstream list order (e.g.
    grouping in `entities`) is preserved on purpose."""
    raw = {
        "type": "test",
        "entities": [
            {"type": "z_entity", "brief": "Z", "stability": "beta"},
            {"type": "a_entity", "brief": "A", "stability": "alpha"},
        ],
        "feature_gates": [
            {"id": "gate.two", "stage": "beta", "description": "Second"},
            {"id": "gate.one", "stage": "alpha", "description": "First"},
        ],
    }
    result = MetadataParserV1().parse(raw)

    # List element order is untouched: z_entity/gate.two still come first.
    assert [e["type"] for e in result["entities"]] == ["z_entity", "a_entity"]
    assert [g["id"] for g in result["feature_gates"]] == ["gate.two", "gate.one"]
    # But each dict's own keys are sorted.
    for entity in result["entities"]:
        assert list(entity.keys()) == sorted(entity.keys())
    for gate in result["feature_gates"]:
        assert list(gate.keys()) == sorted(gate.keys())


def test_parser_v1_does_not_reorder_order_significant_lists():
    """Sequence values that are order-significant, like a histogram's
    `bucket_boundaries`, must never be reordered by deep sorting — only
    mapping keys are sorted, never list elements."""
    raw = {
        "type": "test",
        "metrics": {
            "m": {
                "description": "d",
                "unit": "1",
                "histogram": {"value_type": "double", "bucket_boundaries": [100.0, 10.0, 1.0]},
            }
        },
    }
    result = MetadataParserV1().parse(raw)
    assert result["metrics"]["m"]["histogram"]["bucket_boundaries"] == [100.0, 10.0, 1.0]


def test_parser_v1_normalizes_events_like_metrics():
    """`events` entries share the exact per-entry shape as `metrics` entries
    (enabled/description/attributes/...), so they reuse `_parse_metrics`:
    sorted keys, sanitized descriptions, sorted attribute lists."""
    raw = {
        "type": "test",
        "events": {
            "zebra.event": {
                "enabled": True,
                "description": "Zebra event.",
                "attributes": ["z_attr", "a_attr"],
            },
            "alpha.event": {
                "enabled": True,
                "description": "Multi-line\ndescription.",
                "attributes": ["b_attr"],
            },
        },
    }
    result = MetadataParserV1().parse(raw)

    events = result["events"]
    assert list(events.keys()) == ["alpha.event", "zebra.event"]
    assert events["alpha.event"]["description"] == "Multi-line description."
    assert events["zebra.event"]["attributes"] == ["a_attr", "z_attr"]


def test_parser_v1_events_passes_through_unknown_subfields():
    """Event sub-fields with no dedicated normalizer (e.g. `entity`) are
    preserved, not dropped, just like on metrics."""
    raw = {
        "type": "test",
        "events": {
            "some.event": {
                "enabled": True,
                "description": "An event.",
                "entity": "host",
            }
        },
    }
    result = MetadataParserV1().parse(raw)
    assert result["events"]["some.event"]["entity"] == "host"


def test_parser_v1_preserves_fields_that_previously_had_no_op_normalizers():
    """`type`/`display_name` at the top level, `status.class`/`codeowners`,
    `attribute.type`/`name_override`, and `metric.unit`/`enabled`/`sum`/
    `gauge`/`histogram`/`stability` used to be copied via explicit
    single-line reassignment with no actual processing. That reassignment
    code was removed in favor of the generic passthrough merge, so this
    verifies those fields still come through correctly via the public
    parser behavior."""
    raw = {
        "type": "otlp",
        "display_name": "OTLP Receiver",
        "status": {
            "class": "receiver",
            "codeowners": {"active": ["someone"]},
        },
        "attributes": {
            "http.method": {
                "type": "string",
                "name_override": "method",
            }
        },
        "metrics": {
            "requests.count": {
                "unit": "1",
                "enabled": True,
                "sum": {"value_type": "int", "monotonic": True},
                "gauge": {"value_type": "double"},
                "histogram": {"value_type": "int"},
                "stability": "beta",
            }
        },
    }
    result = MetadataParserV1().parse(raw)

    assert result["type"] == "otlp"
    assert result["display_name"] == "OTLP Receiver"
    assert result["status"]["class"] == "receiver"
    assert result["status"]["codeowners"] == {"active": ["someone"]}
    assert result["attributes"]["http.method"]["type"] == "string"
    assert result["attributes"]["http.method"]["name_override"] == "method"
    metric = result["metrics"]["requests.count"]
    assert metric["unit"] == "1"
    assert metric["enabled"] is True
    assert metric["sum"] == {"value_type": "int", "monotonic": True}
    assert metric["gauge"] == {"value_type": "double"}
    assert metric["histogram"] == {"value_type": "int"}
    assert metric["stability"] == "beta"


def test_parser_v1_parses_telemetry_metrics():
    """The `telemetry` field (internal metrics the component emits) is
    preserved, and its metrics get the same normalization as top-level
    `metrics`: sorted keys and sanitized descriptions."""
    raw = {
        "type": "memory_limiter",
        "telemetry": {
            "metrics": {
                "processor_memory_limiter_refused_spans": {
                    "enabled": True,
                    "description": "Number of spans rejected\nby downstream.",
                    "stability": "alpha",
                    "unit": "{span}",
                    "sum": {"value_type": "int", "monotonic": True},
                },
                "processor_memory_limiter_accepted_spans": {
                    "enabled": True,
                    "description": "Number of spans accepted.",
                    "stability": "alpha",
                    "unit": "{span}",
                    "sum": {"value_type": "int", "monotonic": True},
                },
            }
        },
    }
    result = MetadataParserV1().parse(raw)

    assert "telemetry" in result
    metrics = result["telemetry"]["metrics"]
    # Sorted by key, same as top-level metrics.
    assert list(metrics.keys()) == [
        "processor_memory_limiter_accepted_spans",
        "processor_memory_limiter_refused_spans",
    ]
    # Description sanitization applies inside telemetry metrics too.
    assert metrics["processor_memory_limiter_refused_spans"]["description"] == (
        "Number of spans rejected by downstream."
    )
    assert metrics["processor_memory_limiter_refused_spans"]["sum"] == {
        "value_type": "int",
        "monotonic": True,
    }


def test_parser_v1_telemetry_passes_through_unknown_sibling_keys():
    """A future sibling of `telemetry.metrics` is preserved, not dropped."""
    raw = {
        "type": "test",
        "telemetry": {"metrics": {}, "future_telemetry_field": "value"},
    }
    result = MetadataParserV1().parse(raw)
    assert result["telemetry"]["future_telemetry_field"] == "value"


def test_parser_v1_status_passes_through_unknown_subfields():
    """`status.deprecation` / `status.warnings` (present in the upstream schema
    but previously unhandled) are preserved, not dropped."""
    raw = {
        "type": "test",
        "status": {
            "class": "processor",
            "warnings": ["This component is unmaintained."],
            "deprecation": {"traces": {"date": "2026-01-01", "migration": "use X instead"}},
        },
    }
    result = MetadataParserV1().parse(raw)
    status = result["status"]
    assert status["warnings"] == ["This component is unmaintained."]
    assert status["deprecation"] == {"traces": {"date": "2026-01-01", "migration": "use X instead"}}


def test_parser_v1_attribute_passes_through_unknown_subfields():
    """`requirement_level` / `semantic_convention` on an attribute (present
    upstream but previously unhandled) are preserved, not dropped."""
    raw = {
        "type": "test",
        "attributes": {
            "http.method": {
                "description": "HTTP method",
                "type": "string",
                "requirement_level": "required",
                "semantic_convention": {"ref": "http"},
            }
        },
    }
    result = MetadataParserV1().parse(raw)
    attr = result["attributes"]["http.method"]
    assert attr["requirement_level"] == "required"
    assert attr["semantic_convention"] == {"ref": "http"}


def test_parser_v1_metric_passes_through_unknown_subfields():
    """`entity` / `semantic_convention` / `migration` on a metric (present
    upstream but previously unhandled) are preserved, not dropped."""
    raw = {
        "type": "test",
        "metrics": {
            "system.cpu.utilization": {
                "description": "CPU utilization",
                "unit": "1",
                "gauge": {"value_type": "double"},
                "stability": "beta",
                "entity": "host",
                "semantic_convention": {"ref": "system.cpu"},
                "migration": {"to": "system.cpu.usage", "through_gates": {"disable_old": "gate1"}},
            }
        },
    }
    result = MetadataParserV1().parse(raw)
    metric = result["metrics"]["system.cpu.utilization"]
    assert metric["entity"] == "host"
    assert metric["semantic_convention"] == {"ref": "system.cpu"}
    assert metric["migration"] == {"to": "system.cpu.usage", "through_gates": {"disable_old": "gate1"}}


# ---------------------------------------------------------------------------
# MetadataParserFactory
# ---------------------------------------------------------------------------


def test_factory_get_parser_v1():
    parser = MetadataParserFactory.get_parser("v1")
    assert isinstance(parser, MetadataParserV1)


def test_factory_get_default_parser_returns_latest():
    parser = MetadataParserFactory.get_default_parser()
    assert isinstance(parser, MetadataParserV1)


def test_factory_raises_on_unknown_version():
    with pytest.raises(ValueError, match="Unsupported schema_version"):
        MetadataParserFactory.get_parser("v99")


def test_factory_error_message_lists_supported_versions():
    with pytest.raises(ValueError, match="v1"):
        MetadataParserFactory.get_parser("v_unknown")


# ---------------------------------------------------------------------------
# parse_component_metadata convenience function
# ---------------------------------------------------------------------------


def test_parse_component_metadata_none_version_uses_default():
    raw = {"type": "otlp"}
    result = parse_component_metadata(raw, schema_version=None)
    assert result is not None
    assert result["type"] == "otlp"


def test_parse_component_metadata_explicit_v1():
    raw = {"type": "batch"}
    result = parse_component_metadata(raw, schema_version="v1")
    assert result["type"] == "batch"


def test_parse_component_metadata_raises_on_bad_version():
    with pytest.raises(ValueError):
        parse_component_metadata({"type": "test"}, schema_version="v_bad")


def test_parse_component_metadata_returns_none_for_empty():
    assert parse_component_metadata({}) is None


# ---------------------------------------------------------------------------
# MetadataParser file-I/O wrapper — schema_version auto-detection
# ---------------------------------------------------------------------------


def test_metadata_parser_accepts_schema_version_override(temp_component_dir):
    """Explicit schema_version is forwarded to the factory."""
    create_metadata_file(temp_component_dir, "type: otlp")
    parser = MetadataParser(temp_component_dir)
    result = parser.parse(schema_version="v1")
    assert result is not None
    assert result["type"] == "otlp"


def test_metadata_parser_raises_on_unsupported_schema_version(temp_component_dir):
    """Unsupported explicit schema_version propagates as ValueError."""
    create_metadata_file(temp_component_dir, "type: otlp")
    parser = MetadataParser(temp_component_dir)
    with pytest.raises(ValueError, match="Unsupported schema_version"):
        parser.parse(schema_version="v_bad")


def test_metadata_parser_auto_detects_schema_version_field(temp_component_dir):
    """If metadata.yaml carries a schema_version field matching a known version, it is used."""
    content = "type: test\nschema_version: v1\n"
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    result = parser.parse()
    assert result is not None
    assert result["type"] == "test"


def test_metadata_parser_unknown_schema_version_in_file_raises(temp_component_dir):
    """An unknown schema_version declared inside metadata.yaml is propagated as ValueError."""
    content = "type: test\nschema_version: v_future\n"
    create_metadata_file(temp_component_dir, content)
    parser = MetadataParser(temp_component_dir)
    with pytest.raises(ValueError, match="Unsupported schema_version"):
        parser.parse()
