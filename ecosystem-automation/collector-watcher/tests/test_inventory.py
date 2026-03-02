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
"""Tests for inventory manager."""

import shutil
import tempfile
from pathlib import Path

import pytest
import yaml
from collector_watcher.inventory_manager import InventoryManager
from semantic_version import Version


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
    return Version("0.112.0")


@pytest.fixture
def sample_snapshot_version():
    return Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))


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
    assert loaded["version"] == "0.112.0"
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
    assert loaded["version"] == "0.112.0"
    assert loaded["repository"] == "opentelemetry-collector-contrib"
    assert loaded["components"] == sample_components


def test_load_nonexistent_versioned_inventory(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    loaded = manager.load_versioned_inventory("contrib", sample_version)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "0.112.0"
    assert loaded["components"] == {}


def test_list_versions(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    v1 = Version("0.110.0")
    v2 = Version("0.111.0")
    v3 = Version("0.112.0")

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
    assert str(versions[0]) == "0.112.0"
    assert str(versions[1]) == "0.111.0"
    assert str(versions[2]) == "0.110.0"


def test_list_snapshot_versions(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    # Create mix of release and snapshot versions
    v1 = Version("0.112.0")
    v2 = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    v3 = Version(major=0, minor=114, patch=0, prerelease=("SNAPSHOT",))

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
    assert all(v.prerelease for v in snapshots)


def test_list_release_versions(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    # Create mix of release and snapshot versions
    v1 = Version("0.112.0")
    v2 = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    v3 = Version("0.113.0")
    v4 = Version(major=0, minor=114, patch=0, prerelease=("SNAPSHOT",))

    for version in [v1, v2, v3, v4]:
        manager.save_versioned_inventory(
            distribution="contrib",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector-contrib",
        )

    # List release versions only
    releases = manager.list_release_versions("contrib")

    assert len(releases) == 2
    assert all(not v.prerelease for v in releases)
    # Should be sorted newest to oldest
    assert str(releases[0]) == "0.113.0"
    assert str(releases[1]) == "0.112.0"


def test_cleanup_snapshots(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    v1 = Version("0.112.0")
    v2 = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    v3 = Version(major=0, minor=114, patch=0, prerelease=("SNAPSHOT",))

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


def test_load_deprecations_nonexistent(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))

    deprecations = manager.load_deprecations()

    assert "core" in deprecations
    assert "contrib" in deprecations
    for dist in ["core", "contrib"]:
        for component_type in ["connector", "exporter", "extension", "processor", "receiver"]:
            assert component_type in deprecations[dist]
            assert deprecations[dist][component_type] == []


def test_save_and_load_deprecations(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))

    deprecations = {
        "core": {
            "receiver": [
                {
                    "name": "examplereceiver",
                    "last_version": "v0.139.0",
                    "deprecated_in_version": "v0.140.0",
                    "source_repo": "core",
                    "distributions": ["core"],
                    "subtype": None,
                }
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
        "contrib": {
            "receiver": [],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }

    manager.save_deprecations(deprecations)

    deprecations_file = temp_inventory_dir / "deprecations.yaml"
    assert deprecations_file.exists()

    loaded = manager.load_deprecations()
    assert loaded["core"]["receiver"][0]["name"] == "examplereceiver"
    assert loaded["core"]["receiver"][0]["last_version"] == "v0.139.0"
    assert loaded["core"]["receiver"][0]["deprecated_in_version"] == "v0.140.0"


def test_add_deprecated_components(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))

    deprecations = manager.load_deprecations()

    new_deprecated = {
        "receiver": [
            {
                "name": "examplereceiver",
                "last_version": "v0.139.0",
                "deprecated_in_version": "v0.140.0",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            }
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    manager.add_deprecated_components(deprecations, "core", new_deprecated)

    assert len(deprecations["core"]["receiver"]) == 1
    assert deprecations["core"]["receiver"][0]["name"] == "examplereceiver"


def test_add_deprecated_components_avoid_duplicates(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))

    deprecations = {
        "core": {
            "receiver": [
                {
                    "name": "examplereceiver",
                    "last_version": "v0.139.0",
                    "deprecated_in_version": "v0.140.0",
                    "source_repo": "core",
                    "distributions": ["core"],
                    "subtype": None,
                }
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
        "contrib": {
            "receiver": [],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }

    new_deprecated = {
        "receiver": [
            {
                "name": "examplereceiver",
                "last_version": "v0.139.0",
                "deprecated_in_version": "v0.140.0",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            }
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    manager.add_deprecated_components(deprecations, "core", new_deprecated)

    assert len(deprecations["core"]["receiver"]) == 1


def test_add_deprecated_components_multiple_distributions(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))

    deprecations = manager.load_deprecations()

    core_deprecated = {
        "receiver": [
            {
                "name": "corereceiver",
                "last_version": "v0.139.0",
                "deprecated_in_version": "v0.140.0",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            }
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    contrib_deprecated = {
        "receiver": [],
        "processor": [],
        "exporter": [
            {
                "name": "contribexporter",
                "last_version": "v0.140.1",
                "deprecated_in_version": "v0.141.0",
                "source_repo": "contrib",
                "distributions": ["contrib"],
                "subtype": None,
            }
        ],
        "connector": [],
        "extension": [],
    }

    manager.add_deprecated_components(deprecations, "core", core_deprecated)
    manager.add_deprecated_components(deprecations, "contrib", contrib_deprecated)

    assert len(deprecations["core"]["receiver"]) == 1
    assert deprecations["core"]["receiver"][0]["name"] == "corereceiver"
    assert len(deprecations["contrib"]["exporter"]) == 1
    assert deprecations["contrib"]["exporter"][0]["name"] == "contribexporter"
