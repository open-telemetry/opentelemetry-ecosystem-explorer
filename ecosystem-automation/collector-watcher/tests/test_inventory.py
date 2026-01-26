"""Tests for inventory manager."""

import shutil
import tempfile
from pathlib import Path

import pytest
import yaml
from collector_watcher.inventory_manager import InventoryManager
from collector_watcher.version_detector import Version


@pytest.fixture
def temp_inventory_dir():
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


@pytest.fixture
def sample_components():
    return {
        "connector": [],
        "exporter": [
            {"name": "loggingexporter", "has_metadata": True},
        ],
        "extension": [],
        "processor": [
            {"name": "batchprocessor", "has_metadata": True},
        ],
        "receiver": [
            {"name": "otlpreceiver", "has_metadata": True},
            {"name": "customreceiver", "has_metadata": False},
        ],
    }


@pytest.fixture
def sample_version():
    return Version(0, 112, 0)


@pytest.fixture
def sample_snapshot_version():
    return Version(0, 113, 0, is_snapshot=True)


def test_save_versioned_inventory(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="contrib",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector-contrib",
    )

    version_dir = temp_inventory_dir / "contrib" / "v0.112.0"
    assert version_dir.exists()
    assert (version_dir / "receiver.yaml").exists()
    assert (version_dir / "processor.yaml").exists()

    with open(version_dir / "receiver.yaml") as f:
        loaded = yaml.safe_load(f)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "v0.112.0"
    assert loaded["repository"] == "opentelemetry-collector-contrib"
    assert loaded["component_type"] == "receiver"
    assert len(loaded["components"]) == 2


def test_load_versioned_inventory(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="contrib",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector-contrib",
    )

    loaded = manager.load_versioned_inventory("contrib", sample_version)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "v0.112.0"
    assert loaded["repository"] == "opentelemetry-collector-contrib"
    assert loaded["components"] == sample_components


def test_load_nonexistent_versioned_inventory(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    loaded = manager.load_versioned_inventory("contrib", sample_version)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "v0.112.0"
    assert loaded["components"] == {}


def test_list_versions(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    v1 = Version(0, 110, 0)
    v2 = Version(0, 111, 0)
    v3 = Version(0, 112, 0)

    for version in [v1, v2, v3]:
        manager.save_versioned_inventory(
            distribution="contrib",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector-contrib",
        )

    versions = manager.list_versions("contrib")

    assert len(versions) == 3
    # Should be sorted newest to oldest
    assert str(versions[0]) == "v0.112.0"
    assert str(versions[1]) == "v0.111.0"
    assert str(versions[2]) == "v0.110.0"


def test_list_snapshot_versions(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    # Create mix of release and snapshot versions
    v1 = Version(0, 112, 0)
    v2 = Version(0, 113, 0, is_snapshot=True)
    v3 = Version(0, 114, 0, is_snapshot=True)

    for version in [v1, v2, v3]:
        manager.save_versioned_inventory(
            distribution="contrib",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector-contrib",
        )

    # List snapshot versions only
    snapshots = manager.list_snapshot_versions("contrib")

    assert len(snapshots) == 2
    assert all(v.is_snapshot for v in snapshots)


def test_cleanup_snapshots(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    v1 = Version(0, 112, 0)
    v2 = Version(0, 113, 0, is_snapshot=True)
    v3 = Version(0, 114, 0, is_snapshot=True)

    for version in [v1, v2, v3]:
        manager.save_versioned_inventory(
            distribution="contrib",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector-contrib",
        )

    assert manager.version_exists("contrib", v1)
    assert manager.version_exists("contrib", v2)
    assert manager.version_exists("contrib", v3)

    removed = manager.cleanup_snapshots("contrib")

    assert removed == 2
    # Release should still exist
    assert manager.version_exists("contrib", v1)
    # Snapshots should be gone
    assert not manager.version_exists("contrib", v2)
    assert not manager.version_exists("contrib", v3)


def test_version_exists(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    assert not manager.version_exists("contrib", sample_version)

    manager.save_versioned_inventory(
        distribution="contrib",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector-contrib",
    )

    assert manager.version_exists("contrib", sample_version)


def test_versioned_inventory_separate_distributions_stored_separately(
    temp_inventory_dir, sample_components, sample_version
):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
    )

    manager.save_versioned_inventory(
        distribution="contrib",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector-contrib",
    )

    # Verify both exist separately
    core_dir = temp_inventory_dir / "core" / "v0.112.0"
    contrib_dir = temp_inventory_dir / "contrib" / "v0.112.0"

    assert core_dir.exists()
    assert contrib_dir.exists()

    core_inv = manager.load_versioned_inventory("core", sample_version)
    contrib_inv = manager.load_versioned_inventory("contrib", sample_version)

    assert core_inv["repository"] == "opentelemetry-collector"
    assert contrib_inv["repository"] == "opentelemetry-collector-contrib"
