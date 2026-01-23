"""Tests for component scanner."""

import shutil
import tempfile
from pathlib import Path

import pytest
from collector_watcher.component_scanner import ComponentScanner


@pytest.fixture
def mock_repo():
    """Create a temporary mock repository structure."""
    temp_dir = tempfile.mkdtemp()
    repo_path = Path(temp_dir)

    receiver_with_meta = repo_path / "receiver" / "otlpreceiver"
    receiver_with_meta.mkdir(parents=True)
    (receiver_with_meta / "go.mod").touch()
    (receiver_with_meta / "metadata.yaml").write_text("type: otlp")

    receiver_no_meta = repo_path / "receiver" / "customreceiver"
    receiver_no_meta.mkdir(parents=True)
    (receiver_no_meta / "go.mod").touch()

    processor_with_meta = repo_path / "processor" / "batchprocessor"
    processor_with_meta.mkdir(parents=True)
    (processor_with_meta / "go.mod").touch()
    (processor_with_meta / "metadata.yaml").write_text("type: batch")

    # Exporter without go.mod but with .go files
    exporter_go_files = repo_path / "exporter" / "loggingexporter"
    exporter_go_files.mkdir(parents=True)
    (exporter_go_files / "exporter.go").touch()
    (exporter_go_files / "metadata.yaml").write_text("type: logging")

    # Internal directory (should be ignored)
    internal_dir = repo_path / "receiver" / "internal"
    internal_dir.mkdir(parents=True)
    (internal_dir / "go.mod").touch()

    # Testdata directory (should be ignored)
    testdata_dir = repo_path / "processor" / "testdata"
    testdata_dir.mkdir(parents=True)
    (testdata_dir / "go.mod").touch()

    # Hidden directory (should be ignored)
    hidden_dir = repo_path / "exporter" / ".hidden"
    hidden_dir.mkdir(parents=True)
    (hidden_dir / "go.mod").touch()

    yield repo_path

    shutil.rmtree(temp_dir)


def test_scan_receivers(mock_repo):
    scanner = ComponentScanner(str(mock_repo))
    receivers = scanner.scan_component_type("receiver")

    assert len(receivers) == 2
    assert any(r["name"] == "otlpreceiver" for r in receivers)
    assert any(r["name"] == "customreceiver" for r in receivers)
    assert not any(r["name"] == "internal" for r in receivers)


def test_scan_processors(mock_repo):
    scanner = ComponentScanner(str(mock_repo))
    processors = scanner.scan_component_type("processor")

    assert len(processors) == 1
    assert processors[0]["name"] == "batchprocessor"
    assert not any(p["name"] == "testdata" for p in processors)


def test_scan_exporters(mock_repo):
    scanner = ComponentScanner(str(mock_repo))
    exporters = scanner.scan_component_type("exporter")

    assert len(exporters) == 1
    assert exporters[0]["name"] == "loggingexporter"
    assert not any(e["name"] == ".hidden" for e in exporters)


def test_metadata_detection(mock_repo):
    scanner = ComponentScanner(str(mock_repo))
    components = scanner.scan_all_components()

    otlp = next(r for r in components["receiver"] if r["name"] == "otlpreceiver")
    assert "metadata" in otlp

    custom = next(r for r in components["receiver"] if r["name"] == "customreceiver")
    assert custom.get("has_metadata") is False

    batch = next(p for p in components["processor"] if p["name"] == "batchprocessor")
    assert "metadata" in batch

    logging = next(e for e in components["exporter"] if e["name"] == "loggingexporter")
    assert "metadata" in logging


def test_scan_all_components(mock_repo):
    """Test scanning all component types."""
    scanner = ComponentScanner(str(mock_repo))
    components = scanner.scan_all_components()

    assert "receiver" in components
    assert "processor" in components
    assert "exporter" in components
    assert len(components["receiver"]) == 2
    assert len(components["processor"]) == 1
    assert len(components["exporter"]) == 1


@pytest.fixture
def mock_repo_with_nested():
    """Create a temporary mock repository with nested extension directories."""
    temp_dir = tempfile.mkdtemp()
    repo_path = Path(temp_dir)

    # Create a regular extension
    regular_ext = repo_path / "extension" / "healthcheckextension"
    regular_ext.mkdir(parents=True)
    (regular_ext / "go.mod").touch()
    (regular_ext / "metadata.yaml").write_text("type: health_check")

    # Create encoding extensions (nested)
    encoding_dir = repo_path / "extension" / "encoding"
    encoding_dir.mkdir(parents=True)
    (encoding_dir / "encoding.go").touch()  # Parent has .go file but no go.mod

    encoding_ext1 = encoding_dir / "otlpencodingextension"
    encoding_ext1.mkdir(parents=True)
    (encoding_ext1 / "go.mod").touch()
    (encoding_ext1 / "metadata.yaml").write_text("type: otlp_encoding")

    encoding_ext2 = encoding_dir / "jsonlogencodingextension"
    encoding_ext2.mkdir(parents=True)
    (encoding_ext2 / "go.mod").touch()
    (encoding_ext2 / "metadata.yaml").write_text("type: jsonlog_encoding")

    # Create observer extensions (nested)
    observer_dir = repo_path / "extension" / "observer"
    observer_dir.mkdir(parents=True)

    observer_ext = observer_dir / "hostobserver"
    observer_ext.mkdir(parents=True)
    (observer_ext / "go.mod").touch()
    (observer_ext / "metadata.yaml").write_text("type: host_observer")

    # Create storage extensions (nested)
    storage_dir = repo_path / "extension" / "storage"
    storage_dir.mkdir(parents=True)

    storage_ext = storage_dir / "filestorage"
    storage_ext.mkdir(parents=True)
    (storage_ext / "go.mod").touch()
    (storage_ext / "metadata.yaml").write_text("type: file_storage")

    # Create internal directory inside nested (should be ignored)
    internal_dir = encoding_dir / "internal"
    internal_dir.mkdir(parents=True)
    (internal_dir / "go.mod").touch()

    yield repo_path

    # Cleanup
    shutil.rmtree(temp_dir)


def test_scan_nested_encoding_extensions(mock_repo_with_nested):
    """Test scanning nested encoding extensions."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    # Should find 5 extensions total
    assert len(extensions) == 5

    # Find encoding extensions
    encoding_exts = [e for e in extensions if e.get("subtype") == "encoding"]
    assert len(encoding_exts) == 2
    assert any(e["name"] == "otlpencodingextension" for e in encoding_exts)
    assert any(e["name"] == "jsonlogencodingextension" for e in encoding_exts)


def test_scan_nested_observer_extensions(mock_repo_with_nested):
    """Test scanning nested observer extensions."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    observer_exts = [e for e in extensions if e.get("subtype") == "observer"]
    assert len(observer_exts) == 1
    assert observer_exts[0]["name"] == "hostobserver"


def test_scan_nested_storage_extensions(mock_repo_with_nested):
    """Test scanning nested storage extensions."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    storage_exts = [e for e in extensions if e.get("subtype") == "storage"]
    assert len(storage_exts) == 1
    assert storage_exts[0]["name"] == "filestorage"


def test_scan_regular_extensions_no_subtype(mock_repo_with_nested):
    """Test that regular extensions don't have a subtype field."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    regular_exts = [e for e in extensions if e.get("subtype") is None]
    assert len(regular_exts) == 1
    assert regular_exts[0]["name"] == "healthcheckextension"


def test_nested_excludes_internal_directories(mock_repo_with_nested):
    """Test that internal directories inside nested dirs are excluded."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    # Should not find internal directory
    names = [e["name"] for e in extensions]
    assert "internal" not in names


def test_subtype_field_in_component_info(mock_repo_with_nested):
    """Test that subtype field is included in component info."""
    scanner = ComponentScanner(str(mock_repo_with_nested))
    extensions = scanner.scan_component_type("extension")

    encoding_ext = next(e for e in extensions if e["name"] == "otlpencodingextension")
    assert encoding_ext["subtype"] == "encoding"
    assert "metadata" in encoding_ext


def test_invalid_repo_path():
    """Test that ComponentScanner raises ValueError for non-existent path."""
    with pytest.raises(ValueError, match="does not exist"):
        ComponentScanner("/nonexistent/path/to/repo")


def test_nonexistent_component_type(mock_repo):
    """Test scanning a component type directory that doesn't exist."""
    scanner = ComponentScanner(str(mock_repo))
    result = scanner.scan_component_type("nonexistent")
    assert result == []


def test_scan_empty_component_type_directory(mock_repo):
    """Test scanning an empty component type directory."""
    empty_dir = mock_repo / "connector"
    empty_dir.mkdir()

    scanner = ComponentScanner(str(mock_repo))
    connectors = scanner.scan_component_type("connector")
    assert len(connectors) == 0
