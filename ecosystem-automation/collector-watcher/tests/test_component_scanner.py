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
"""Tests for component scanner."""

import pytest
from collector_watcher.component_scanner import ComponentScanner


@pytest.fixture
def mock_repo(tmp_path):
    """Create a temporary mock repository structure."""
    repo_path = tmp_path

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

    return repo_path


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
def mock_repo_with_nested(tmp_path):
    """Create a temporary mock repository with nested extension directories."""
    repo_path = tmp_path

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

    return repo_path


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


# ---------------------------------------------------------------------------
# status.class based filtering (#991)
#
# Internal interface packages (e.g. receiver/xreceiver) live under a real
# component-type directory and pass go.mod/name checks, but declare
# status.class: pkg upstream rather than the matching component type. These
# tests exercise the _extract_component_info status.class check that skips
# such directories instead of cataloging them as real components.
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_repo_with_class_metadata(tmp_path):
    """Mock repo covering status.class match / mismatch / absence for a top-level type."""
    repo_path = tmp_path

    # Real component: status.class matches its directory's component_type.
    real_receiver = repo_path / "receiver" / "otlpreceiver"
    real_receiver.mkdir(parents=True)
    (real_receiver / "go.mod").touch()
    (real_receiver / "metadata.yaml").write_text("type: otlp\nstatus:\n  class: receiver\n")

    # Internal interface package: status.class is "pkg", not "receiver" (the #991 case).
    pkg_receiver = repo_path / "receiver" / "xreceiver"
    pkg_receiver.mkdir(parents=True)
    (pkg_receiver / "go.mod").touch()
    (pkg_receiver / "metadata.yaml").write_text("type: xreceiver\nstatus:\n  class: pkg\n")

    # metadata.yaml present with a status block but no class field: must fail open.
    no_class_receiver = repo_path / "receiver" / "noclassreceiver"
    no_class_receiver.mkdir(parents=True)
    (no_class_receiver / "go.mod").touch()
    (no_class_receiver / "metadata.yaml").write_text("type: noclass\nstatus:\n  stability:\n    beta: [traces]\n")

    # metadata.yaml present with no status block at all: must also fail open.
    no_status_receiver = repo_path / "receiver" / "nostatusreceiver"
    no_status_receiver.mkdir(parents=True)
    (no_status_receiver / "go.mod").touch()
    (no_status_receiver / "metadata.yaml").write_text("type: nostatus\n")

    # metadata.yaml present with non-dict status block (e.g. string): must fail open.
    non_dict_status_receiver = repo_path / "receiver" / "nondictstatusreceiver"
    non_dict_status_receiver.mkdir(parents=True)
    (non_dict_status_receiver / "go.mod").touch()
    (non_dict_status_receiver / "metadata.yaml").write_text("type: nondictstatus\nstatus: invalid_string\n")

    return repo_path


def test_excludes_pkg_class_component(mock_repo_with_class_metadata):
    """A directory whose upstream status.class is "pkg" (an internal interface package,
    not a real component) must not be discovered."""
    scanner = ComponentScanner(str(mock_repo_with_class_metadata))
    receivers = scanner.scan_component_type("receiver")

    assert not any(r["name"] == "xreceiver" for r in receivers)


def test_includes_component_with_matching_class(mock_repo_with_class_metadata):
    """A real component whose status.class matches its directory's component_type
    is still discovered."""
    scanner = ComponentScanner(str(mock_repo_with_class_metadata))
    receivers = scanner.scan_component_type("receiver")

    assert any(r["name"] == "otlpreceiver" for r in receivers)


def test_includes_component_with_missing_status_class(mock_repo_with_class_metadata):
    """A component with a status block but no class field must fail open (stay
    included) - class is documented upstream as optional for subcomponents."""
    scanner = ComponentScanner(str(mock_repo_with_class_metadata))
    receivers = scanner.scan_component_type("receiver")

    assert any(r["name"] == "noclassreceiver" for r in receivers)


def test_includes_component_with_no_status_block(mock_repo_with_class_metadata):
    """A component with metadata.yaml but no status block at all must fail open."""
    scanner = ComponentScanner(str(mock_repo_with_class_metadata))
    receivers = scanner.scan_component_type("receiver")

    assert any(r["name"] == "nostatusreceiver" for r in receivers)


def test_includes_component_with_non_dict_status(mock_repo_with_class_metadata):
    """A component with a non-dict status field (e.g., status: string) must fail open
    without raising an AttributeError when accessing status.class."""
    scanner = ComponentScanner(str(mock_repo_with_class_metadata))
    receivers = scanner.scan_component_type("receiver")

    assert any(r["name"] == "nondictstatusreceiver" for r in receivers)


@pytest.fixture
def mock_repo_with_nested_class_metadata(tmp_path):
    """Mock repo covering status.class match / mismatch for a nested subtype directory."""
    repo_path = tmp_path

    storage_dir = repo_path / "extension" / "storage"
    storage_dir.mkdir(parents=True)

    # Real nested component: status.class equals the *parent* type ("extension"), not
    # the subtype ("storage") - matches real upstream shape (e.g. filestorage).
    real_storage_ext = storage_dir / "filestorage"
    real_storage_ext.mkdir(parents=True)
    (real_storage_ext / "go.mod").touch()
    (real_storage_ext / "metadata.yaml").write_text("type: file_storage\nstatus:\n  class: extension\n")

    # Internal interface package nested under a subtype dir: status.class is "pkg".
    pkg_storage_ext = storage_dir / "xstorage"
    pkg_storage_ext.mkdir(parents=True)
    (pkg_storage_ext / "go.mod").touch()
    (pkg_storage_ext / "metadata.yaml").write_text("type: xstorage\nstatus:\n  class: pkg\n")

    return repo_path


def test_nested_component_with_matching_parent_class_included(mock_repo_with_nested_class_metadata):
    """Nested/subtype components declare status.class equal to their parent
    component_type (e.g. "extension", not "storage") - this must still match."""
    scanner = ComponentScanner(str(mock_repo_with_nested_class_metadata))
    extensions = scanner.scan_component_type("extension")

    assert any(e["name"] == "filestorage" for e in extensions)


def test_nested_pkg_class_component_excluded(mock_repo_with_nested_class_metadata):
    """A pkg-class package nested under a subtype directory must also be excluded."""
    scanner = ComponentScanner(str(mock_repo_with_nested_class_metadata))
    extensions = scanner.scan_component_type("extension")

    assert not any(e["name"] == "xstorage" for e in extensions)


@pytest.mark.parametrize(
    ("component_type", "name"),
    [
        ("receiver", "xreceiver"),
        ("exporter", "xexporter"),
        ("processor", "xprocessor"),
        ("connector", "xconnector"),
        ("extension", "xextension"),
    ],
)
def test_excludes_known_pkg_class_interface_packages(tmp_path, component_type, name):
    """Regression test for #991: the five internal interface packages upstream marks
    status.class: pkg must not be discovered as real components of any type."""
    component_dir = tmp_path / component_type / name
    component_dir.mkdir(parents=True)
    (component_dir / "go.mod").touch()
    (component_dir / "metadata.yaml").write_text(f"type: {name}\nstatus:\n  class: pkg\n")

    scanner = ComponentScanner(str(tmp_path))
    components = scanner.scan_component_type(component_type)

    assert components == []
