"""Tests for database writer."""

import json
from pathlib import Path

import pytest
from explorer_db_builder.database_writer import DatabaseWriter
from semantic_version import Version


@pytest.fixture
def temp_db_dir(tmp_path):
    return tmp_path / "test_db"


@pytest.fixture
def db_writer(temp_db_dir):
    return DatabaseWriter(database_dir=str(temp_db_dir))


@pytest.fixture
def sample_libraries():
    return [
        {
            "name": "akka-http",
            "version": "1.0",
            "description": "Akka HTTP instrumentation",
        },
        {
            "name": "aws-sdk",
            "version": "2.0",
            "description": "AWS SDK instrumentation",
        },
    ]


class TestDatabaseWriterInit:
    def test_init_with_default_path(self):
        """Default path is set correctly."""
        writer = DatabaseWriter()
        assert writer.database_dir == Path("ecosystem-explorer/public/data/javaagent")
        assert writer.files_written == 0
        assert writer.total_bytes == 0

    def test_init_with_custom_path(self, temp_db_dir):
        """Custom path is set correctly."""
        writer = DatabaseWriter(database_dir=str(temp_db_dir))
        assert writer.database_dir == temp_db_dir
        assert writer.files_written == 0
        assert writer.total_bytes == 0


class TestGetFilePath:
    def test_get_file_path_creates_directory(self, db_writer, temp_db_dir):
        """Directory structure is created if it doesn't exist."""
        db_writer._get_file_path("test-lib", "abc123")
        expected_dir = temp_db_dir / "instrumentations" / "test-lib"
        assert expected_dir.exists()
        assert expected_dir.is_dir()

    def test_get_file_path_format(self, db_writer, temp_db_dir):
        """File path has correct format."""
        file_path = db_writer._get_file_path("test-lib", "abc123")
        expected_path = temp_db_dir / "instrumentations" / "test-lib" / "test-lib-abc123.json"
        assert file_path == expected_path

    def test_get_file_path_multiple_calls(self, db_writer):
        """Multiple calls create different paths."""
        path1 = db_writer._get_file_path("lib1", "hash1")
        path2 = db_writer._get_file_path("lib2", "hash2")
        assert path1 != path2
        assert path1.parent != path2.parent


class TestWriteLibraries:
    def test_write_libraries_success(self, db_writer, sample_libraries, temp_db_dir):
        """Libraries are written successfully and map is returned."""
        library_map = db_writer.write_libraries(sample_libraries)

        assert len(library_map) == 2
        assert "akka-http" in library_map
        assert "aws-sdk" in library_map

        # Verify hashes are 12 characters
        assert len(library_map["akka-http"]) == 12
        assert len(library_map["aws-sdk"]) == 12

        # Verify files exist
        for lib_name, lib_hash in library_map.items():
            file_path = db_writer._get_file_path(lib_name, lib_hash)
            assert file_path.exists()

    def test_write_libraries_content(self, db_writer, sample_libraries):
        """Written files contain correct JSON content."""
        library_map = db_writer.write_libraries(sample_libraries)

        akka_path = db_writer._get_file_path("akka-http", library_map["akka-http"])
        with open(akka_path, "r", encoding="utf-8") as f:
            content = json.load(f)

        assert content["name"] == "akka-http"
        assert content["version"] == "1.0"
        assert content["description"] == "Akka HTTP instrumentation"

    def test_write_libraries_empty_list(self, db_writer):
        """Empty library list raises ValueError."""
        with pytest.raises(ValueError, match="Libraries list cannot be empty"):
            db_writer.write_libraries([])

    def test_write_libraries_missing_name(self, db_writer, caplog):
        """Libraries without name are skipped with warning."""
        libraries = [
            {"name": "valid-lib", "version": "1.0"},
            {"version": "2.0"},  # Missing name
        ]

        library_map = db_writer.write_libraries(libraries)

        assert len(library_map) == 1
        assert "valid-lib" in library_map
        assert "missing 'name' field" in caplog.text

    def test_write_libraries_invalid_type(self, db_writer, caplog):
        """Non-dict items are skipped with warning."""
        libraries = [
            {"name": "valid-lib", "version": "1.0"},
            "invalid",  # Not a dict
            {"name": "another-lib", "version": "2.0"},
        ]

        library_map = db_writer.write_libraries(libraries)

        assert len(library_map) == 2
        assert "valid-lib" in library_map
        assert "another-lib" in library_map
        assert "not a dictionary" in caplog.text

    def test_write_libraries_no_valid_items(self, db_writer):
        """No valid libraries raises ValueError."""
        libraries = [
            "invalid",
            {"no_name": "value"},
        ]

        with pytest.raises(ValueError, match="No valid libraries were processed"):
            db_writer.write_libraries(libraries)

    def test_write_libraries_same_content_same_hash(self, db_writer):
        """Same library content produces same hash."""
        lib1 = {"name": "test-lib", "value": 1}
        lib2 = {"name": "test-lib", "value": 1}

        map1 = db_writer.write_libraries([lib1])
        map2 = db_writer.write_libraries([lib2])

        assert map1["test-lib"] == map2["test-lib"]

    def test_write_libraries_different_content_different_hash(self, db_writer):
        """Different library content produces different hashes."""
        lib1 = {"name": "test-lib", "value": 1}
        lib2 = {"name": "test-lib", "value": 2}

        map1 = db_writer.write_libraries([lib1])
        map2 = db_writer.write_libraries([lib2])

        assert map1["test-lib"] != map2["test-lib"]

    def test_write_libraries_skip_existing(self, db_writer, caplog):
        """Existing files are not rewritten."""
        import logging

        caplog.set_level(logging.DEBUG)

        libraries = [{"name": "test-lib", "version": "1.0"}]

        # Write first time
        library_map = db_writer.write_libraries(libraries)
        first_hash = library_map["test-lib"]

        # Write second time with same content
        caplog.clear()
        library_map = db_writer.write_libraries(libraries)

        assert library_map["test-lib"] == first_hash
        assert "already exists" in caplog.text

    def test_write_libraries_non_serializable(self, db_writer, caplog):
        """Non-serializable content is skipped with error."""
        libraries = [
            {"name": "valid-lib", "version": "1.0"},
            {"name": "invalid-lib", "func": lambda x: x},  # Non-serializable
        ]

        library_map = db_writer.write_libraries(libraries)

        assert len(library_map) == 1
        assert "valid-lib" in library_map
        assert "invalid-lib" not in library_map
        assert "Failed to hash" in caplog.text


class TestWriteVersionIndex:
    def test_write_version_index_success(self, db_writer, temp_db_dir):
        """Version index is written successfully."""
        version = Version("2.1.0")
        library_map = {"lib1": "abc123", "lib2": "def456"}

        db_writer.write_version_index(version, library_map)

        version_file = temp_db_dir / "versions" / "2.1.0-index.json"
        assert version_file.exists()

        with open(version_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["version"] == "2.1.0"
        assert data["instrumentations"] == library_map

    def test_write_version_index_creates_directory(self, db_writer, temp_db_dir):
        """Versions directory is created if it doesn't exist."""
        version = Version("1.0.0")
        library_map = {"lib1": "abc123"}

        versions_dir = temp_db_dir / "versions"
        assert not versions_dir.exists()

        db_writer.write_version_index(version, library_map)

        assert versions_dir.exists()
        assert versions_dir.is_dir()

    def test_write_version_index_empty_map(self, db_writer):
        """Empty library map raises ValueError."""
        version = Version("1.0.0")

        with pytest.raises(ValueError, match="Library map cannot be empty"):
            db_writer.write_version_index(version, {})

    def test_write_version_index_multiple_versions(self, db_writer, temp_db_dir):
        """Multiple versions can be written."""
        v1 = Version("1.0.0")
        v2 = Version("2.0.0")

        db_writer.write_version_index(v1, {"lib1": "hash1"})
        db_writer.write_version_index(v2, {"lib2": "hash2"})

        assert (temp_db_dir / "versions" / "1.0.0-index.json").exists()
        assert (temp_db_dir / "versions" / "2.0.0-index.json").exists()


class TestWriteVersionList:
    def test_write_version_list_success(self, db_writer, temp_db_dir):
        """Version list is written successfully."""
        versions = [Version("2.0.0"), Version("1.5.0"), Version("1.0.0")]

        db_writer.write_version_list(versions)

        version_file = temp_db_dir / "versions-index.json"
        assert version_file.exists()

        with open(version_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "versions" in data
        assert len(data["versions"]) == 3

        # First version should be marked as latest
        assert data["versions"][0]["version"] == "2.0.0"
        assert data["versions"][0]["is_latest"] is True

        # Other versions should not be latest
        assert data["versions"][1]["is_latest"] is False
        assert data["versions"][2]["is_latest"] is False

    def test_write_version_list_single_version(self, db_writer, temp_db_dir):
        """Single version is marked as latest."""
        versions = [Version("1.0.0")]

        db_writer.write_version_list(versions)

        version_file = temp_db_dir / "versions-index.json"
        with open(version_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert len(data["versions"]) == 1
        assert data["versions"][0]["is_latest"] is True

    def test_write_version_list_empty(self, db_writer):
        """Empty version list raises ValueError."""
        with pytest.raises(ValueError, match="Versions list cannot be empty"):
            db_writer.write_version_list([])

    def test_write_version_list_creates_directory(self, db_writer, temp_db_dir):
        """Database directory is created if it doesn't exist."""
        assert not temp_db_dir.exists()

        db_writer.write_version_list([Version("1.0.0")])

        assert temp_db_dir.exists()
        assert temp_db_dir.is_dir()


class TestGetStats:
    def test_get_stats_initial_state(self, db_writer):
        """Initial stats show zero files and bytes."""
        stats = db_writer.get_stats()
        assert stats["files_written"] == 0
        assert stats["total_bytes"] == 0

    def test_get_stats_after_writing_libraries(self, db_writer, sample_libraries):
        """Stats are updated after writing libraries."""
        db_writer.write_libraries(sample_libraries)
        stats = db_writer.get_stats()

        assert stats["files_written"] == 2
        assert stats["total_bytes"] > 0

    def test_get_stats_after_version_index(self, db_writer):
        """Stats include version index file."""
        library_map = {"lib1": "abc123"}
        db_writer.write_version_index(Version("1.0.0"), library_map)

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0

    def test_get_stats_after_version_list(self, db_writer):
        """Stats include version list file."""
        versions = [Version("1.0.0")]
        db_writer.write_version_list(versions)

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0

    def test_get_stats_cumulative(self, db_writer, sample_libraries):
        """Stats accumulate across multiple operations."""
        # Write libraries
        db_writer.write_libraries(sample_libraries)
        after_libs = db_writer.get_stats()

        # Write version index
        library_map = {"lib1": "abc123"}
        db_writer.write_version_index(Version("1.0.0"), library_map)
        after_version = db_writer.get_stats()

        # Write version list
        db_writer.write_version_list([Version("1.0.0")])
        final = db_writer.get_stats()

        assert after_version["files_written"] > after_libs["files_written"]
        assert final["files_written"] > after_version["files_written"]
        assert after_version["total_bytes"] > after_libs["total_bytes"]
        assert final["total_bytes"] > after_version["total_bytes"]

    def test_get_stats_skips_existing_files(self, db_writer):
        """Stats only count newly written files, not skipped ones."""
        libraries = [{"name": "test-lib", "version": "1.0"}]

        # Write first time
        db_writer.write_libraries(libraries)
        first_stats = db_writer.get_stats()

        # Write second time with same content (should be skipped)
        db_writer.write_libraries(libraries)
        second_stats = db_writer.get_stats()

        # Stats should remain the same since file was skipped
        assert second_stats["files_written"] == first_stats["files_written"]
        assert second_stats["total_bytes"] == first_stats["total_bytes"]


class TestClean:
    def test_clean_removes_existing_directory(self, db_writer, temp_db_dir):
        """Clean removes existing database directory."""
        # Create some files in the database directory
        test_dir = temp_db_dir / "test_subdir"
        test_dir.mkdir(parents=True)
        test_file = test_dir / "test_file.json"
        test_file.write_text("test content")

        assert test_dir.exists()
        assert test_file.exists()

        db_writer.clean()

        # Directory should be recreated but empty
        assert temp_db_dir.exists()
        assert not test_dir.exists()
        assert not test_file.exists()

    def test_clean_creates_directory_if_not_exists(self, db_writer, temp_db_dir):
        """Clean creates database directory if it doesn't exist."""
        assert not temp_db_dir.exists()

        db_writer.clean()

        assert temp_db_dir.exists()
        assert temp_db_dir.is_dir()

    def test_clean_with_nested_structure(self, db_writer, temp_db_dir):
        """Clean removes complex nested directory structure."""
        # Create a complex nested structure
        (temp_db_dir / "instrumentations" / "lib1").mkdir(parents=True)
        (temp_db_dir / "instrumentations" / "lib2").mkdir(parents=True)
        (temp_db_dir / "versions").mkdir(parents=True)

        (temp_db_dir / "instrumentations" / "lib1" / "file1.json").write_text("{}")
        (temp_db_dir / "instrumentations" / "lib2" / "file2.json").write_text("{}")
        (temp_db_dir / "versions" / "index.json").write_text("{}")
        (temp_db_dir / "root.json").write_text("{}")

        db_writer.clean()

        # Root directory should exist but be empty
        assert temp_db_dir.exists()
        assert not (temp_db_dir / "instrumentations").exists()
        assert not (temp_db_dir / "versions").exists()
        assert not (temp_db_dir / "root.json").exists()


class TestIntegration:
    def test_full_workflow(self, db_writer, sample_libraries, temp_db_dir):
        """Complete workflow from libraries to version list."""
        library_map = db_writer.write_libraries(sample_libraries)

        version = Version("2.0.0")
        db_writer.write_version_index(version, library_map)

        versions = [version]
        db_writer.write_version_list(versions)

        assert (temp_db_dir / "versions-index.json").exists()
        assert (temp_db_dir / "versions" / "2.0.0-index.json").exists()

        for lib_name, lib_hash in library_map.items():
            lib_path = db_writer._get_file_path(lib_name, lib_hash)
            assert lib_path.exists()

    def test_multiple_versions_workflow(self, db_writer, temp_db_dir):
        """Multiple versions can be processed."""
        # Version 1
        libs_v1 = [{"name": "lib1", "version": "1.0"}]
        map_v1 = db_writer.write_libraries(libs_v1)
        db_writer.write_version_index(Version("1.0.0"), map_v1)

        # Version 2 with updated library
        libs_v2 = [{"name": "lib1", "version": "2.0"}]
        map_v2 = db_writer.write_libraries(libs_v2)
        db_writer.write_version_index(Version("2.0.0"), map_v2)

        # Different hashes for different content
        assert map_v1["lib1"] != map_v2["lib1"]

        # Write version list
        versions = [Version("2.0.0"), Version("1.0.0")]
        db_writer.write_version_list(versions)

        # Verify structure
        assert (temp_db_dir / "versions" / "1.0.0-index.json").exists()
        assert (temp_db_dir / "versions" / "2.0.0-index.json").exists()
