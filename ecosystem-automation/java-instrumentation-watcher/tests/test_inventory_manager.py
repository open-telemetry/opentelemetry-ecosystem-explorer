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

import tempfile
from pathlib import Path

import pytest
import yaml
from java_instrumentation_watcher.inventory_manager import InventoryManager
from semantic_version import Version


@pytest.fixture
def temp_inventory_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def inventory_manager(temp_inventory_dir):
    return InventoryManager(inventory_dir=temp_inventory_dir)


class TestInventoryManager:
    def test_get_version_dir(self, inventory_manager, temp_inventory_dir):
        version = Version("2.10.0")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v2.10.0"
        assert version_dir == expected

    def test_get_version_dir_snapshot(self, inventory_manager, temp_inventory_dir):
        version = Version("2.11.0-SNAPSHOT")
        version_dir = inventory_manager.get_version_dir(version)

        expected = Path(temp_inventory_dir) / "v2.11.0-SNAPSHOT"
        assert version_dir == expected

    def test_save_versioned_inventory(self, inventory_manager):
        version = Version("2.10.0")
        instrumentations = {
            "file_format": 0.1,
            "libraries": [
                {"id": "akka-actor", "name": "Akka Actor", "stability": "stable", "tags": ["akka"]},
                {"id": "apache-camel", "name": "Apache Camel", "stability": "stable", "tags": ["apache"]},
            ],
        }

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        version_dir = inventory_manager.get_version_dir(version)
        file_path = version_dir / "instrumentation.yaml"
        assert file_path.exists()

        with open(file_path) as f:
            data = yaml.safe_load(f)
            assert data["file_format"] == 0.1
            assert isinstance(data["libraries"], list)
            assert len(data["libraries"]) == 2
            assert data["libraries"][0]["id"] == "akka-actor"
            assert data["libraries"][0]["tags"] == ["akka"]

    def test_load_versioned_inventory(self, inventory_manager):
        version = Version("2.10.0")
        instrumentations = {
            "file_format": 0.1,
            "libraries": [
                {"id": "akka-actor", "name": "Akka Actor", "tags": ["akka"]},
            ],
        }

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        loaded = inventory_manager.load_versioned_inventory(version)

        assert loaded["file_format"] == 0.1
        assert isinstance(loaded["libraries"], list)
        assert loaded["libraries"][0]["id"] == "akka-actor"
        assert loaded["libraries"][0]["tags"] == ["akka"]

    def test_load_nonexistent_inventory(self, inventory_manager):
        version = Version("2.10.0")
        loaded = inventory_manager.load_versioned_inventory(version)

        assert loaded["file_format"] == 0.1
        assert loaded["libraries"] == []

    def test_load_versioned_inventory_rejects_non_mapping_yaml(self, inventory_manager):
        version = Version("2.10.0")
        version_dir = inventory_manager.get_version_dir(version)
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "instrumentation.yaml").write_text("- not-a-mapping\n", encoding="utf-8")

        with pytest.raises(ValueError, match="must contain a mapping"):
            inventory_manager.load_versioned_inventory(version)

    def test_list_versions(self, inventory_manager):
        versions = [
            Version("2.9.0"),
            Version("2.10.0"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations={"file_format": 0.1, "libraries": []},
            )

        listed_versions = inventory_manager.list_versions()

        # Should be sorted newest to oldest
        assert len(listed_versions) == 3
        assert listed_versions[0] == Version("2.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("2.10.0")
        assert listed_versions[2] == Version("2.9.0")

    def test_list_versions_empty(self, inventory_manager):
        versions = inventory_manager.list_versions()
        assert versions == []

    def test_list_snapshot_versions(self, inventory_manager):
        versions = [
            Version("2.9.0"),
            Version("2.10.0-SNAPSHOT"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations={"file_format": 0.1, "libraries": []},
            )

        snapshots = inventory_manager.list_snapshot_versions()

        assert len(snapshots) == 2
        assert all(v.prerelease for v in snapshots)
        assert Version("2.9.0") not in snapshots

    def test_cleanup_snapshots(self, inventory_manager):
        versions = [
            Version("2.9.0"),
            Version("2.10.0-SNAPSHOT"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations={"file_format": 0.1, "libraries": []},
            )

        removed_count = inventory_manager.cleanup_snapshots()

        assert removed_count == 2

        # Verify only release remains
        remaining_versions = inventory_manager.list_versions()
        assert len(remaining_versions) == 1
        assert remaining_versions[0] == Version("2.9.0")

    def test_version_exists(self, inventory_manager):
        version = Version("2.10.0")

        assert not inventory_manager.version_exists(version)

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.1, "libraries": []},
        )

        assert inventory_manager.version_exists(version)

    def test_save_with_snapshot_version(self, inventory_manager):
        version = Version("2.11.0-SNAPSHOT")
        instrumentations = {
            "file_format": 0.1,
            "libraries": [{"id": "test", "tags": ["test"]}],
        }

        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations=instrumentations,
        )

        version_dir = inventory_manager.get_version_dir(version)
        assert version_dir.name == "v2.11.0-SNAPSHOT"

    def test_version_comparison_in_list(self, inventory_manager):
        versions = [
            Version("1.0.0"),
            Version("2.10.0"),
            Version("2.9.0"),
            Version("2.10.1"),
            Version("2.11.0-SNAPSHOT"),
        ]

        for version in versions:
            inventory_manager.save_versioned_inventory(
                version=version,
                instrumentations={"file_format": 0.1, "libraries": []},
            )

        listed_versions = inventory_manager.list_versions()

        # Verify proper semantic version sorting (newest first)
        assert listed_versions[0] == Version("2.11.0-SNAPSHOT")
        assert listed_versions[1] == Version("2.10.1")
        assert listed_versions[2] == Version("2.10.0")
        assert listed_versions[3] == Version("2.9.0")
        assert listed_versions[4] == Version("1.0.0")

    def test_list_versions_skips_invalid_dirs(self, inventory_manager):
        valid_version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=valid_version,
            instrumentations={"file_format": 0.1, "libraries": []},
        )

        # Create an invalid directory
        invalid_dir = inventory_manager.inventory_dir / "not-a-version"
        invalid_dir.mkdir(parents=True)

        # List should only include valid version
        versions = inventory_manager.list_versions()
        assert len(versions) == 1
        assert versions[0] == valid_version

    # --- save_library_readmes ---

    def test_readmes_synced_false_when_not_set(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={"file_format": 0.1, "libraries": [{"name": "mylib"}]},
        )
        assert not inventory_manager.readmes_synced(version)

    def test_readmes_synced_true_when_flag_present(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "readmes_synced": True,
                "libraries": [{"name": "mylib", "readme": "mylib-abc123def456.md"}],
            },
        )
        assert inventory_manager.readmes_synced(version)

    def test_save_library_readmes_writes_content_addressed_files(self, inventory_manager):
        version = Version("2.10.0")
        readmes = [
            ("akka-actor-2.3", "# Akka Actor"),
            ("apache-httpclient-4.3", "# Apache HttpClient"),
        ]

        written = inventory_manager.save_library_readmes(version, readmes)

        # Returns a dict mapping library name -> filename
        assert isinstance(written, dict)
        assert len(written) == 2
        assert "akka-actor-2.3" in written
        assert "apache-httpclient-4.3" in written
        # Files should be in the global library_readmes dir, not in the version dir
        readme_dir = inventory_manager.inventory_dir / "library_readmes"
        files = list(readme_dir.glob("*.md"))
        assert len(files) == 2

    def test_save_library_readmes_filename_format(self, inventory_manager):
        from watcher_common.content_hashing import compute_content_hash

        version = Version("2.10.0")
        content = "# Hello"
        expected_hash = compute_content_hash(content)

        written = inventory_manager.save_library_readmes(version, [("mylib-1.0", content)])

        readme_dir = inventory_manager.inventory_dir / "library_readmes"
        expected_file = readme_dir / f"mylib-1.0-{expected_hash}.md"
        assert expected_file.exists()
        assert expected_file.read_text(encoding="utf-8") == content
        assert written["mylib-1.0"] == f"mylib-1.0-{expected_hash}.md"

    def test_save_library_readmes_idempotent(self, inventory_manager):
        version = Version("2.10.0")
        readmes = [("mylib-1.0", "# Content")]

        first = inventory_manager.save_library_readmes(version, readmes)
        second = inventory_manager.save_library_readmes(version, readmes)

        assert first == second
        assert "mylib-1.0" in first
        readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert len(list(readme_dir.glob("*.md"))) == 1

    def test_save_library_readmes_different_content_same_name(self, inventory_manager):
        version = Version("2.10.0")

        first = inventory_manager.save_library_readmes(version, [("mylib-1.0", "# v1")])
        second = inventory_manager.save_library_readmes(version, [("mylib-1.0", "# v2")])

        assert first["mylib-1.0"] != second["mylib-1.0"]
        readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert len(list(readme_dir.glob("*.md"))) == 2

    def test_cleanup_snapshots_does_not_affect_global_readmes(self, inventory_manager):
        snapshot = Version("2.10.0-SNAPSHOT")
        inventory_manager.save_versioned_inventory(
            version=snapshot,
            instrumentations={"file_format": 0.1, "libraries": []},
        )
        inventory_manager.save_library_readmes(snapshot, [("mylib-1.0", "# Content")])

        # Global readme dir should have the file
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert global_readme_dir.exists()
        assert len(list(global_readme_dir.glob("*.md"))) == 1

        inventory_manager.cleanup_snapshots()

        # Snapshot version dir is gone, but global readmes remain
        snapshot_dir = inventory_manager.get_version_dir(snapshot)
        assert not snapshot_dir.exists()
        assert len(list(global_readme_dir.glob("*.md"))) == 1


class TestLibraryReadme:
    """Tests for library README discovery and loading."""

    def test_parse_readme_filename(self, inventory_manager):
        # Valid cases (12 char hash)
        assert inventory_manager._parse_readme_filename("mylib-abc123def456.md") == ("mylib", "abc123def456")
        assert inventory_manager._parse_readme_filename("my-lib-1.0-abc123def456.md") == ("my-lib-1.0", "abc123def456")

        # Invalid cases
        assert inventory_manager._parse_readme_filename("mylib-abc123.md") is None  # Too short
        assert inventory_manager._parse_readme_filename("mylib-abc123def4567.md") is None  # Too long
        assert inventory_manager._parse_readme_filename("-abc123def456.md") is None  # Empty name
        assert inventory_manager._parse_readme_filename("mylib.md") is None  # No hash

    def test_load_library_readme_map_reads_from_yaml(self, inventory_manager):
        """load_library_readme_map should read from instrumentation.yaml, not the filesystem."""
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [
                    {"name": "mylib", "readme": "mylib-abc123def456.md"},
                    {"name": "other-lib", "readme": "other_lib-ffffff000000.md"},
                    {"name": "no-readme-lib"},
                ],
            },
        )

        readme_map = inventory_manager.load_library_readme_map(version)

        assert len(readme_map) == 2
        assert readme_map["mylib"] == "abc123def456"
        # Key is the raw library name from YAML (not sanitized)
        assert readme_map["other-lib"] == "ffffff000000"
        assert "no-readme-lib" not in readme_map

    def test_load_library_readme_map_empty_when_no_readme_fields(self, inventory_manager):
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [{"name": "mylib"}, {"name": "other-lib"}],
            },
        )
        readme_map = inventory_manager.load_library_readme_map(version)
        # No libraries have a 'readme' field (pre-migration state), and no legacy
        # per-version library_readmes/ directory exists in this fixture, so both
        # the new YAML path and the legacy fallback return {} – which is correct.
        assert readme_map == {}

    def test_load_library_readme_content_reads_from_global_dir(self, inventory_manager):
        """load_library_readme_content should read from global library_readmes dir."""
        library_name = "../dangerous"
        sanitized_name = ".._dangerous"
        markdown_hash = "abc123def456"

        # Write the file in the GLOBAL readmes dir (not version-specific)
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        (global_readme_dir / f"{sanitized_name}-{markdown_hash}.md").write_text("safe content")

        version = Version("1.0.0")
        content = inventory_manager.load_library_readme_content(version, library_name, markdown_hash)
        assert content == "safe content"

    def test_prune_orphan_readmes(self, inventory_manager):
        """prune_orphan_readmes should delete files not referenced by any instrumentation.yaml."""
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [{"name": "mylib", "readme": "mylib-abc123def456.md"}],
            },
        )

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        (global_readme_dir / "mylib-abc123def456.md").write_text("# Mylib")
        (global_readme_dir / "orphan1-deadbeef0001.md").write_text("# Orphan1")
        (global_readme_dir / "orphan2-deadbeef0002.md").write_text("# Orphan2")

        removed = inventory_manager.prune_orphan_readmes()

        assert removed == 2
        assert (global_readme_dir / "mylib-abc123def456.md").exists()
        assert not (global_readme_dir / "orphan1-deadbeef0001.md").exists()
        assert not (global_readme_dir / "orphan2-deadbeef0002.md").exists()

    def test_prune_orphan_readmes_no_refs_returns_zero(self, inventory_manager):
        """prune_orphan_readmes must NOT delete anything when no version references any README.

        This is the state of the registry before the #883 migration: no instrumentation.yaml
        has a 'readme' field, so referenced_files is empty.  Deleting every file in the
        global directory would be destructive and wrong.
        """
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                # No 'readme' fields – mirrors today's registry state pre-migration.
                "libraries": [{"name": "mylib"}, {"name": "other-lib"}],
            },
        )

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        kept1 = global_readme_dir / "mylib-abc123def456.md"
        kept2 = global_readme_dir / "other_lib-ffffff000000.md"
        kept1.write_text("# Mylib")
        kept2.write_text("# Other")

        removed = inventory_manager.prune_orphan_readmes()

        # Must return 0 and leave all files intact.
        assert removed == 0
        assert kept1.exists()
        assert kept2.exists()
