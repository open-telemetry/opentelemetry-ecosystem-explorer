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
from watcher_common.content_hashing import compute_content_hash


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


def test_save_versioned_inventory_includes_schema_hash(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="abc123def456",
    )

    with open(temp_inventory_dir / "core" / "v0.112.0" / "receiver.yaml") as f:
        loaded = yaml.safe_load(f)

    assert loaded["schema_hash"] == "abc123def456"


def test_save_versioned_inventory_default_schema_hash(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
    )

    with open(temp_inventory_dir / "core" / "v0.112.0" / "receiver.yaml") as f:
        loaded = yaml.safe_load(f)

    assert loaded["schema_hash"] == "unknown"


def test_load_versioned_inventory(temp_inventory_dir, sample_components, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="contrib",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector-contrib",
        schema_hash="aabbccddeeff",
    )

    loaded = manager.load_versioned_inventory("contrib", sample_version)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "0.112.0"
    assert loaded["repository"] == "opentelemetry-collector-contrib"
    assert loaded["schema_hash"] == "aabbccddeeff"
    assert loaded["components"] == sample_components


def test_load_versioned_inventory_backward_compat_missing_schema_hash(
    temp_inventory_dir, sample_components, sample_version
):
    """Files written before schema_hash was added should load with 'unknown'."""
    manager = InventoryManager(str(temp_inventory_dir))

    # Write a YAML file without schema_hash to simulate old registry files
    version_dir = temp_inventory_dir / "core" / "v0.112.0"
    version_dir.mkdir(parents=True)
    legacy_data = {
        "distribution": "core",
        "version": "0.112.0",
        "repository": "opentelemetry-collector",
        "component_type": "receiver",
        "components": [],
    }
    with open(version_dir / "receiver.yaml", "w") as f:
        yaml.dump(legacy_data, f)
    # Write stubs for the other component types
    for ct in ["connector", "exporter", "extension", "processor"]:
        stub = {**legacy_data, "component_type": ct}
        with open(version_dir / f"{ct}.yaml", "w") as f:
            yaml.dump(stub, f)

    loaded = manager.load_versioned_inventory("core", sample_version)
    assert loaded["schema_hash"] == "unknown"


def test_load_nonexistent_versioned_inventory(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    loaded = manager.load_versioned_inventory("contrib", sample_version)

    assert loaded["distribution"] == "contrib"
    assert loaded["version"] == "0.112.0"
    assert loaded["schema_hash"] == "unknown"
    assert loaded["components"] == {}


def test_meta_schemas_dir_helper(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))
    expected = temp_inventory_dir / "meta" / "schemas"
    assert manager.meta_schemas_dir() == expected


def test_prune_orphan_schemas_removes_unreferenced_files(temp_inventory_dir, sample_components, sample_version):
    """Schema files in meta/schemas not referenced by any component YAML are deleted."""
    manager = InventoryManager(str(temp_inventory_dir))

    # Register one inventory referencing schema_hash "abc123def456"
    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="abc123def456",
    )

    # Plant two schema files: one referenced, one orphan
    schemas_dir = manager.meta_schemas_dir()
    schemas_dir.mkdir(parents=True)
    (schemas_dir / "abc123def456.yaml").write_text("type: object\n")
    (schemas_dir / "deadbeefcafe.yaml").write_text("type: orphan\n")

    removed = manager.prune_orphan_schemas()

    assert removed == 1
    assert (schemas_dir / "abc123def456.yaml").exists()
    assert not (schemas_dir / "deadbeefcafe.yaml").exists()


def test_prune_orphan_schemas_noop_when_meta_dir_absent(temp_inventory_dir):
    manager = InventoryManager(str(temp_inventory_dir))
    assert manager.prune_orphan_schemas() == 0


def test_prune_orphan_schemas_treats_unknown_as_unreferenced(temp_inventory_dir, sample_components, sample_version):
    """A 'unknown' schema_hash does not protect any file from pruning."""
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="unknown",
    )

    schemas_dir = manager.meta_schemas_dir()
    schemas_dir.mkdir(parents=True)
    (schemas_dir / "abc123def456.yaml").write_text("type: object\n")

    removed = manager.prune_orphan_schemas()

    assert removed == 1
    assert not (schemas_dir / "abc123def456.yaml").exists()


def test_delete_version_prunes_orphan_schemas(temp_inventory_dir, sample_components, sample_version):
    """Deleting the last version that referenced a schema removes the schema file."""
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_versioned_inventory(
        distribution="core",
        version=sample_version,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="abc123def456",
    )

    schemas_dir = manager.meta_schemas_dir()
    schemas_dir.mkdir(parents=True)
    (schemas_dir / "abc123def456.yaml").write_text("type: object\n")

    manager.delete_version("core", sample_version)

    assert not (schemas_dir / "abc123def456.yaml").exists()


def test_cleanup_snapshots_prunes_orphan_schemas(temp_inventory_dir, sample_components):
    """Removing the only snapshot that referenced a schema removes the schema file."""
    manager = InventoryManager(str(temp_inventory_dir))

    snapshot = Version(major=0, minor=113, patch=0, prerelease=("SNAPSHOT",))
    manager.save_versioned_inventory(
        distribution="core",
        version=snapshot,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="abc123def456",
    )

    schemas_dir = manager.meta_schemas_dir()
    schemas_dir.mkdir(parents=True)
    (schemas_dir / "abc123def456.yaml").write_text("type: object\n")

    manager.cleanup_snapshots("core")

    assert not (schemas_dir / "abc123def456.yaml").exists()


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


def test_prune_release_versions_not_in(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    keep = Version("0.112.0")
    drop_older = Version("0.110.0")
    drop_newer = Version("0.113.0")
    snapshot = Version(major=0, minor=114, patch=0, prerelease=("SNAPSHOT",))

    for version in [keep, drop_older, drop_newer, snapshot]:
        manager.save_versioned_inventory(
            distribution="core",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector",
        )

    removed = manager.prune_release_versions_not_in("core", [keep])

    assert removed == 2
    # Listed release survives
    assert manager.version_exists("core", keep)
    # Unlisted releases are gone
    assert not manager.version_exists("core", drop_older)
    assert not manager.version_exists("core", drop_newer)
    # Snapshots are always preserved, even though they are not in the keep list
    assert manager.version_exists("core", snapshot)


def test_prune_release_versions_not_in_keeps_all_listed(temp_inventory_dir, sample_components):
    manager = InventoryManager(str(temp_inventory_dir))

    v1 = Version("0.111.0")
    v2 = Version("0.112.0")

    for version in [v1, v2]:
        manager.save_versioned_inventory(
            distribution="contrib",
            version=version,
            components=sample_components,
            repository="opentelemetry-collector-contrib",
        )

    removed = manager.prune_release_versions_not_in("contrib", [v1, v2])

    assert removed == 0
    assert manager.version_exists("contrib", v1)
    assert manager.version_exists("contrib", v2)


def test_prune_release_versions_not_in_prunes_orphan_schemas(temp_inventory_dir, sample_components):
    """Pruning the last version that referenced a schema removes the schema file."""
    manager = InventoryManager(str(temp_inventory_dir))

    keep = Version("0.112.0")
    drop = Version("0.110.0")

    manager.save_versioned_inventory(
        distribution="core",
        version=keep,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="keepkeepkeep",
    )
    manager.save_versioned_inventory(
        distribution="core",
        version=drop,
        components=sample_components,
        repository="opentelemetry-collector",
        schema_hash="dropdropdrop",
    )

    schemas_dir = manager.meta_schemas_dir()
    schemas_dir.mkdir(parents=True, exist_ok=True)
    (schemas_dir / "keepkeepkeep.yaml").write_text("type: object\n")
    (schemas_dir / "dropdropdrop.yaml").write_text("type: object\n")

    manager.prune_release_versions_not_in("core", [keep])

    # Schema referenced only by the pruned version is removed; the kept one stays.
    assert (schemas_dir / "keepkeepkeep.yaml").exists()
    assert not (schemas_dir / "dropdropdrop.yaml").exists()


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


# --- save_component_readmes / load_component_readme_* ---
#
# Ported from java-instrumentation-watcher's JavaagentInventoryManager readme
# tests (see watcher_common.inventory_manager), adapted for collector's
# (distribution, version) two-key model instead of java's version-only key.


def test_save_component_readmes_writes_content_addressed_files(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    readmes = [
        ("otlpreceiver", "# OTLP Receiver"),
        ("batchprocessor", "# Batch Processor"),
    ]

    written = manager.save_component_readmes("core", sample_version, readmes)

    assert written == 2
    readme_dir = manager.inventory_dir / "core" / "readmes"
    files = list(readme_dir.glob("*.md"))
    assert len(files) == 2


def test_save_component_readmes_filename_format(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    content = "# Hello"
    expected_hash = compute_content_hash(content)

    manager.save_component_readmes("core", sample_version, [("otlpreceiver", content)])

    readme_dir = manager.inventory_dir / "core" / "readmes"
    expected_file = readme_dir / f"otlpreceiver-{expected_hash}.md"
    assert expected_file.exists()
    assert expected_file.read_text(encoding="utf-8") == content


def test_save_component_readmes_idempotent(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    readmes = [("otlpreceiver", "# Content")]

    first = manager.save_component_readmes("core", sample_version, readmes)
    second = manager.save_component_readmes("core", sample_version, readmes)

    assert first == 1
    assert second == 0


def test_save_component_readmes_different_content_same_name(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))

    first = manager.save_component_readmes("core", sample_version, [("otlpreceiver", "# v1")])
    second = manager.save_component_readmes("core", sample_version, [("otlpreceiver", "# v2")])

    assert first == 1
    assert second == 1
    readme_dir = manager.inventory_dir / "core" / "readmes"
    assert len(list(readme_dir.glob("*.md"))) == 2


def test_component_readmes_are_isolated_per_distribution(temp_inventory_dir, sample_version):
    """core and contrib must not share a component_readmes directory, unlike java which has no distribution axis."""
    manager = InventoryManager(str(temp_inventory_dir))

    manager.save_component_readmes("core", sample_version, [("otlpreceiver", "# core version")])
    manager.save_component_readmes("contrib", sample_version, [("otlpreceiver", "# contrib version")])

    core_map = manager.load_component_readme_map("core", sample_version)
    contrib_map = manager.load_component_readme_map("contrib", sample_version)

    core_content = manager.load_component_readme_content("core", "otlpreceiver", core_map["otlpreceiver"])
    contrib_content = manager.load_component_readme_content("contrib", "otlpreceiver", contrib_map["otlpreceiver"])

    assert core_content == "# core version"
    assert contrib_content == "# contrib version"


def test_cleanup_snapshots_removes_component_readmes(temp_inventory_dir, sample_components, sample_snapshot_version):
    manager = InventoryManager(str(temp_inventory_dir))
    manager.save_versioned_inventory(
        distribution="core",
        version=sample_snapshot_version,
        components=sample_components,
        repository="opentelemetry-collector",
    )
    manager.save_component_readmes("core", sample_snapshot_version, [("otlpreceiver", "# Content")])

    snapshot_dir = manager.get_version_dir("core", sample_snapshot_version)
    assert (snapshot_dir / "component-readmes.yaml").exists()

    manager.cleanup_snapshots("core")

    assert not snapshot_dir.exists()


def test_load_component_readme_map_uses_published_index(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    manager.save_component_readmes("core", sample_version, [("otlpreceiver", "old")])
    manager.save_component_readmes("core", sample_version, [("otlpreceiver", "new")])
    index = manager.load_component_readme_map("core", sample_version)
    assert manager.load_component_readme_content("core", "otlpreceiver", index["otlpreceiver"]) == "new"


def test_load_component_readme_content_sanitization(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    readme_dir = manager.inventory_dir / "core" / "readmes"
    readme_dir.mkdir(parents=True)

    # Save a file with a potentially dangerous name that gets sanitized
    component_name = "../dangerous"
    sanitized_name = ".._dangerous"
    markdown_hash = "abc123def456"
    (readme_dir / f"{sanitized_name}-{markdown_hash}.md").write_text("safe content")

    # Should be able to load it using the original (unsanitized) name
    content = manager.load_component_readme_content("core", component_name, markdown_hash)
    assert content == "safe content"


def test_load_component_readme_content_missing_returns_none(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    content = manager.load_component_readme_content("core", "nonexistent", "abc123def456")
    assert content is None


def test_load_component_readme_map_missing_dir_returns_empty(temp_inventory_dir, sample_version):
    manager = InventoryManager(str(temp_inventory_dir))
    assert manager.load_component_readme_map("core", sample_version) == {}


@pytest.mark.parametrize("operation", ["cleanup_snapshots", "delete_version", "prune_release_versions_not_in"])
def test_shared_readme_pruning_preserves_other_references(temp_inventory_dir, operation):
    manager = InventoryManager(str(temp_inventory_dir))
    removed = Version("1.0.0-SNAPSHOT" if operation == "cleanup_snapshots" else "1.0.0")
    kept = Version("2.0.0")
    manager.save_component_readmes("core", removed, [("raw/name", "shared"), ("orphan", "old")])
    assert manager.save_component_readmes("core", kept, [("raw/name", "shared")]) == 0
    manager.save_component_readmes("contrib", removed, [("other", "untouched")])
    other = list((temp_inventory_dir / "contrib" / "readmes").glob("*.md"))
    if operation == "cleanup_snapshots":
        manager.cleanup_snapshots("core")
    elif operation == "delete_version":
        manager.delete_version("core", removed)
    else:
        manager.prune_release_versions_not_in("core", [kept])
    index = manager.load_component_readme_map("core", kept)
    assert manager.load_component_readme_content("core", "raw/name", index["raw/name"]) == "shared"
    assert len(list((temp_inventory_dir / "core" / "readmes").glob("*.md"))) == 1
    assert all(p.exists() for p in other)


@pytest.mark.parametrize(
    "document",
    [
        "[",
        "",
        "[]",
        "null",
        "lib: lib-abc123def456.md\nlib: lib-abc123def456.md",
        "lib: ../lib-abc123def456.md",
        "lib: other-abc123def456.md",
        "lib: 1",
    ],
)
def test_invalid_index_aborts_collector_prune(temp_inventory_dir, document):
    manager = InventoryManager(str(temp_inventory_dir))
    manager.save_component_readmes("core", Version("3.0.0"), [("lib", "keep")])
    manager.save_component_readmes("core", Version("2.0.0"), [("orphan", "unused")])
    manager.save_component_readmes("core", Version("2.0.0"), [])
    path = manager.get_version_dir("core", Version("1.0.0")) / manager.README_INDEX_FILE
    path.parent.mkdir()
    path.write_text(document)
    store = temp_inventory_dir / "core" / "readmes"
    before = {p: p.read_bytes() for p in store.iterdir()}
    with pytest.raises(ValueError):
        manager.prune_orphan_readmes("core")
    assert before == {p: p.read_bytes() for p in store.iterdir()}


def test_unreadable_index_aborts_collector_prune(temp_inventory_dir, monkeypatch):
    manager = InventoryManager(str(temp_inventory_dir))
    manager.save_component_readmes("core", Version("1.0.0"), [("lib", "keep")])

    def unreadable(*args, **kwargs):
        raise PermissionError("unreadable")

    monkeypatch.setattr(Path, "read_text", unreadable)
    with pytest.raises(PermissionError):
        manager.prune_orphan_readmes("core")
    assert len(list((temp_inventory_dir / "core" / "readmes").glob("*.md"))) == 1
