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


def test_parser_v1_ignores_unknown_top_level_fields():
    """Unknown fields (e.g. future schema additions) are silently dropped."""
    raw = {"type": "test", "future_field": "some_value"}
    result = MetadataParserV1().parse(raw)
    assert "future_field" not in result


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
