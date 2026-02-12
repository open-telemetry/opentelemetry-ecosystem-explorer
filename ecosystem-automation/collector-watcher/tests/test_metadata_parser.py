"""Tests for metadata parser."""

import shutil
import tempfile
from pathlib import Path

import pytest
from collector_watcher.metadata_parser import MetadataParser


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
