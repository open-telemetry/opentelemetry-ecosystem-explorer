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

    def test_save_library_readmes_writes_to_global_dir(self, inventory_manager):
        readmes = [
            ("akka-actor-2.3", "# Akka Actor"),
            ("apache-httpclient-4.3", "# Apache HttpClient"),
        ]

        written = inventory_manager.save_library_readmes(readmes)

        assert len(written) == 2
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        files = list(global_readme_dir.glob("*.md"))
        assert len(files) == 2

    def test_save_library_readmes_filename_format(self, inventory_manager):
        from watcher_common.content_hashing import compute_content_hash

        content = "# Hello"
        expected_hash = compute_content_hash(content)

        inventory_manager.save_library_readmes([("mylib-1.0", content)])

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        expected_file = global_readme_dir / f"mylib-1.0-{expected_hash}.md"
        assert expected_file.exists()
        assert expected_file.read_text(encoding="utf-8") == content

    def test_save_library_readmes_returns_name_to_filename_mapping(self, inventory_manager):
        readmes = [("mylib", "# content"), ("other-lib", "# other")]
        written = inventory_manager.save_library_readmes(readmes)

        assert "mylib" in written
        assert "other-lib" in written
        assert written["mylib"].endswith(".md")
        assert written["other-lib"].endswith(".md")

    def test_save_library_readmes_idempotent(self, inventory_manager):
        readmes = [("mylib-1.0", "# Content")]

        first = inventory_manager.save_library_readmes(readmes)
        second = inventory_manager.save_library_readmes(readmes)

        # Both calls return the same mapping
        assert first == second
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert len(list(global_readme_dir.glob("*.md"))) == 1

    def test_save_library_readmes_different_content_same_name(self, inventory_manager):
        first = inventory_manager.save_library_readmes([("mylib-1.0", "# v1")])
        second = inventory_manager.save_library_readmes([("mylib-1.0", "# v2")])

        assert first["mylib-1.0"] != second["mylib-1.0"]
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert len(list(global_readme_dir.glob("*.md"))) == 2

    def test_cleanup_snapshots_does_not_touch_global_readmes(self, inventory_manager):
        """Global library_readmes/ is independent of snapshot cleanup."""
        snapshot = Version("2.10.0-SNAPSHOT")
        inventory_manager.save_versioned_inventory(
            version=snapshot,
            instrumentations={"file_format": 0.1, "libraries": []},
        )
        inventory_manager.save_library_readmes([("mylib-1.0", "# Content")])

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        assert global_readme_dir.exists()

        inventory_manager.cleanup_snapshots()

        # Global readme dir must survive snapshot cleanup
        assert global_readme_dir.exists()
        assert len(list(global_readme_dir.glob("*.md"))) == 1

    # --- README sync state ---

    def test_readmes_synced_false_when_no_state(self, inventory_manager):
        assert not inventory_manager.readmes_synced(Version("2.10.0"))

    def test_record_readme_sync_marks_synced_when_no_failures(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.record_readme_sync(version, {})
        assert inventory_manager.readmes_synced(version)

    def test_record_readme_sync_not_synced_when_retryable_failures(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.record_readme_sync(version, {"akka": 1})
        assert not inventory_manager.readmes_synced(version)

    def test_record_readme_sync_synced_when_all_failures_exhausted(self, inventory_manager):
        """A library at MAX_README_FETCH_ATTEMPTS is given up on, not pending."""
        version = Version("2.10.0")
        max_attempts = inventory_manager.MAX_README_FETCH_ATTEMPTS
        inventory_manager.record_readme_sync(version, {"akka": max_attempts})
        assert inventory_manager.readmes_synced(version)

    def test_get_readme_failures_returns_empty_when_no_state(self, inventory_manager):
        assert inventory_manager.get_readme_failures(Version("2.10.0")) == {}

    def test_get_readme_failures_returns_recorded_failures(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.record_readme_sync(version, {"akka": 2, "spring": 1})
        failures = inventory_manager.get_readme_failures(version)
        assert failures == {"akka": 2, "spring": 1}

    def test_readme_sync_state_file_is_deterministic(self, inventory_manager):
        """State file uses sort_keys=True — diff output must be deterministic."""
        import json

        version = Version("2.10.0")
        inventory_manager.record_readme_sync(version, {"z-lib": 1, "a-lib": 2})

        state_path = inventory_manager.inventory_dir / "readme-sync-state.json"
        raw = state_path.read_text(encoding="utf-8")
        data = json.loads(raw)

        failures = data[str(version)]["failed"]
        assert list(failures.keys()) == sorted(failures.keys())

    # --- load_library_readme_map ---

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
        """load_library_readme_map reads 'readme' refs from instrumentation.yaml."""
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

    def test_load_library_readme_map_falls_back_to_legacy_dir(self, inventory_manager):
        """When no 'readme:' fields exist, fall back to per-version library_readmes/."""
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                # No 'readme:' refs — shape of every registry file before migration.
                "libraries": [{"name": "mylib"}, {"name": "other-lib"}],
            },
        )

        # Populate the legacy per-version directory.
        legacy_dir = inventory_manager.get_version_dir(version) / "library_readmes"
        legacy_dir.mkdir(parents=True, exist_ok=True)
        (legacy_dir / "mylib-abc123def456.md").write_text("# mylib", encoding="utf-8")
        (legacy_dir / "other_lib-ffffff000000.md").write_text("# other", encoding="utf-8")

        readme_map = inventory_manager.load_library_readme_map(version)

        assert len(readme_map) == 2
        assert readme_map["mylib"] == "abc123def456"
        assert readme_map["other_lib"] == "ffffff000000"

    def test_load_library_readme_map_merges_legacy_and_yaml(self, inventory_manager):
        """Partially-migrated state: YAML wins on conflict, legacy fills gaps."""
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [
                    # mylib has a new YAML ref; other-lib only has the legacy file.
                    {"name": "mylib", "readme": "mylib-aaaaaa111111.md"},
                    {"name": "other-lib"},
                ],
            },
        )

        # Populate legacy dir with an older hash for mylib AND the only copy of other-lib.
        legacy_dir = inventory_manager.get_version_dir(version) / "library_readmes"
        legacy_dir.mkdir(parents=True, exist_ok=True)
        (legacy_dir / "mylib-bbbbbb222222.md").write_text("old", encoding="utf-8")
        (legacy_dir / "other_lib-cccccc333333.md").write_text("# other", encoding="utf-8")

        readme_map = inventory_manager.load_library_readme_map(version)

        # YAML ref wins for mylib; legacy fills in other-lib.
        assert readme_map["mylib"] == "aaaaaa111111"
        assert readme_map["other_lib"] == "cccccc333333"

    def test_load_library_readme_map_empty_when_no_readme_fields_and_no_legacy_dir(self, inventory_manager):
        version = Version("1.0.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [{"name": "mylib"}, {"name": "other-lib"}],
            },
        )
        readme_map = inventory_manager.load_library_readme_map(version)
        assert readme_map == {}


class TestLibraryReadmeContent:
    """Tests for load_library_readme_content."""

    def test_load_from_global_dir(self, inventory_manager):
        """load_library_readme_content reads from global library_readmes/ first."""
        library_name = "../dangerous"
        sanitized_name = ".._dangerous"
        markdown_hash = "abc123def456"

        # Write file in the global dir.
        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        (global_readme_dir / f"{sanitized_name}-{markdown_hash}.md").write_text("safe content", encoding="utf-8")

        version = Version("1.0.0")
        content = inventory_manager.load_library_readme_content(version, library_name, markdown_hash)
        assert content == "safe content"

    def test_load_library_readme_content_falls_back_to_version_dir(self, inventory_manager):
        """When absent from global dir, fall back to per-version legacy path."""
        library_name = "mylib"
        markdown_hash = "abc123def456"

        version = Version("1.0.0")
        # Write only to the legacy per-version directory.
        legacy_dir = inventory_manager.get_version_dir(version) / "library_readmes"
        legacy_dir.mkdir(parents=True, exist_ok=True)
        (legacy_dir / f"{library_name}-{markdown_hash}.md").write_text("legacy content", encoding="utf-8")

        content = inventory_manager.load_library_readme_content(version, library_name, markdown_hash)
        assert content == "legacy content"

    def test_load_library_readme_content_returns_none_when_missing(self, inventory_manager):
        version = Version("1.0.0")
        content = inventory_manager.load_library_readme_content(version, "missing-lib", "abc123def456")
        assert content is None


class TestPruneOrphanReadmes:
    """Tests for prune_orphan_readmes."""

    def test_prune_orphan_readmes_removes_unreferenced_files(self, inventory_manager):
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                "libraries": [{"name": "mylib", "readme": "mylib-abc123def456.md"}],
            },
        )

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        (global_readme_dir / "mylib-abc123def456.md").write_text("# referenced", encoding="utf-8")
        (global_readme_dir / "orphan-ffffff000000.md").write_text("# orphan", encoding="utf-8")

        pruned = inventory_manager.prune_orphan_readmes()

        assert pruned == 1
        assert (global_readme_dir / "mylib-abc123def456.md").exists()
        assert not (global_readme_dir / "orphan-ffffff000000.md").exists()

    def test_prune_orphan_readmes_no_refs_returns_zero(self, inventory_manager):
        """When no version references any README (pre-migration), return 0 and leave files intact."""
        version = Version("2.10.0")
        inventory_manager.save_versioned_inventory(
            version=version,
            instrumentations={
                "file_format": 0.1,
                # No 'readme:' refs — the shape of every registry file before migration.
                "libraries": [{"name": "mylib"}],
            },
        )

        global_readme_dir = inventory_manager.inventory_dir / "library_readmes"
        global_readme_dir.mkdir(parents=True, exist_ok=True)
        (global_readme_dir / "mylib-abc123def456.md").write_text("# content", encoding="utf-8")

        pruned = inventory_manager.prune_orphan_readmes()

        assert pruned == 0
        assert (global_readme_dir / "mylib-abc123def456.md").exists()

    def test_prune_orphan_readmes_returns_zero_when_no_global_dir(self, inventory_manager):
        pruned = inventory_manager.prune_orphan_readmes()
        assert pruned == 0


class TestJmxModels:
    def test_jmx_models_index_exists_false_when_missing(self, inventory_manager):
        version = Version("2.30.0")
        assert not inventory_manager.jmx_models_index_exists(version)

    def test_save_jmx_models_index_writes_shared_store_and_index(self, inventory_manager):
        version = Version("2.30.0")
        models = {
            "jvm": "metrics:\n  - jvm_threads_live\n",
            "tomcat": "metrics:\n  - tomcat_sessions\n",
        }
        manifest = "semantic_conventions: v1.43.0\n"

        indexed_models, manifest_file = inventory_manager.save_jmx_models_index(
            version=version,
            models=models,
            manifest=manifest,
        )

        assert set(indexed_models.keys()) == {"jvm", "tomcat"}
        assert manifest_file is not None

        jmx_dir = inventory_manager.get_jmx_store_dir()
        assert (jmx_dir / indexed_models["jvm"]).exists()
        assert (jmx_dir / indexed_models["tomcat"]).exists()
        assert (jmx_dir / manifest_file).exists()

        index_path = inventory_manager.get_version_dir(version) / "jmx-models.yaml"
        assert index_path.exists()

        index = yaml.safe_load(index_path.read_text(encoding="utf-8"))
        assert index["models"] == indexed_models
        assert index["manifest"] == manifest_file

    def test_save_jmx_models_index_is_content_addressed(self, inventory_manager):
        version_a = Version("2.30.0")
        version_b = Version("2.31.0")
        model_content = "metrics:\n  - jvm_threads_live\n"

        first_models, _ = inventory_manager.save_jmx_models_index(
            version=version_a,
            models={"jvm": model_content},
            manifest=None,
        )
        second_models, _ = inventory_manager.save_jmx_models_index(
            version=version_b,
            models={"jvm": model_content},
            manifest=None,
        )

        assert first_models["jvm"] == second_models["jvm"]
        assert len(list(inventory_manager.get_jmx_store_dir().glob("jvm-*.yaml"))) == 1

    def test_save_jmx_models_index_skips_empty_payload(self, inventory_manager):
        version = Version("2.29.0")
        models, manifest = inventory_manager.save_jmx_models_index(version=version, models={}, manifest=None)

        assert models == {}
        assert manifest is None
        assert not inventory_manager.jmx_models_index_exists(version)
        assert not inventory_manager.get_jmx_store_dir().exists()
