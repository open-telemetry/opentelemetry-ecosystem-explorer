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
        writer = DatabaseWriter()
        assert writer.database_dir == Path("ecosystem-explorer/public/data/javaagent")
        assert writer.files_written == 0
        assert writer.total_bytes == 0

    def test_init_with_custom_path(self, temp_db_dir):
        writer = DatabaseWriter(database_dir=str(temp_db_dir))
        assert writer.database_dir == temp_db_dir
        assert writer.files_written == 0
        assert writer.total_bytes == 0


class TestGetFilePath:
    def test_get_file_path_creates_directory(self, db_writer, temp_db_dir):
        db_writer._get_file_path("test-lib", "abc123")
        expected_dir = temp_db_dir / "instrumentations" / "test-lib"
        assert expected_dir.exists()
        assert expected_dir.is_dir()

    def test_get_file_path_format(self, db_writer, temp_db_dir):
        file_path = db_writer._get_file_path("test-lib", "abc123")
        expected_path = temp_db_dir / "instrumentations" / "test-lib" / "test-lib-abc123.json"
        assert file_path == expected_path

    def test_get_file_path_multiple_calls(self, db_writer):
        path1 = db_writer._get_file_path("lib1", "hash1")
        path2 = db_writer._get_file_path("lib2", "hash2")
        assert path1 != path2
        assert path1.parent != path2.parent


class TestWriteLibraries:
    def test_write_libraries_success(self, db_writer, sample_libraries, temp_db_dir):
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
        libraries = [
            {"name": "valid-lib", "version": "1.0"},
            {"version": "2.0"},  # Missing name
        ]

        library_map = db_writer.write_libraries(libraries)

        assert len(library_map) == 1
        assert "valid-lib" in library_map
        assert "missing 'name' field" in caplog.text

    def test_write_libraries_invalid_type(self, db_writer, caplog):
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
        libraries = [
            "invalid",
            {"no_name": "value"},
        ]

        with pytest.raises(ValueError, match="No valid libraries were processed"):
            db_writer.write_libraries(libraries)

    def test_write_libraries_same_content_same_hash(self, db_writer):
        lib1 = {"name": "test-lib", "value": 1}
        lib2 = {"name": "test-lib", "value": 1}

        map1 = db_writer.write_libraries([lib1])
        map2 = db_writer.write_libraries([lib2])

        assert map1["test-lib"] == map2["test-lib"]

    def test_write_libraries_different_content_different_hash(self, db_writer):
        lib1 = {"name": "test-lib", "value": 1}
        lib2 = {"name": "test-lib", "value": 2}

        map1 = db_writer.write_libraries([lib1])
        map2 = db_writer.write_libraries([lib2])

        assert map1["test-lib"] != map2["test-lib"]

    def test_write_libraries_skip_existing(self, db_writer, caplog):
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
        version = Version("1.0.0")
        library_map = {"lib1": "abc123"}

        versions_dir = temp_db_dir / "versions"
        assert not versions_dir.exists()

        db_writer.write_version_index(version, library_map)

        assert versions_dir.exists()
        assert versions_dir.is_dir()

    def test_write_version_index_empty_map(self, db_writer):
        version = Version("1.0.0")

        with pytest.raises(ValueError, match="Library map and custom map cannot both be empty"):
            db_writer.write_version_index(version, {})

    def test_write_version_index_multiple_versions(self, db_writer, temp_db_dir):
        v1 = Version("1.0.0")
        v2 = Version("2.0.0")

        db_writer.write_version_index(v1, {"lib1": "hash1"})
        db_writer.write_version_index(v2, {"lib2": "hash2"})

        assert (temp_db_dir / "versions" / "1.0.0-index.json").exists()
        assert (temp_db_dir / "versions" / "2.0.0-index.json").exists()


class TestWriteVersionList:
    def test_write_version_list_success(self, db_writer, temp_db_dir):
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
        versions = [Version("1.0.0")]

        db_writer.write_version_list(versions)

        version_file = temp_db_dir / "versions-index.json"
        with open(version_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert len(data["versions"]) == 1
        assert data["versions"][0]["is_latest"] is True

    def test_write_version_list_empty(self, db_writer):
        with pytest.raises(ValueError, match="Versions list cannot be empty"):
            db_writer.write_version_list([])

    def test_write_version_list_creates_directory(self, db_writer, temp_db_dir):
        assert not temp_db_dir.exists()

        db_writer.write_version_list([Version("1.0.0")])

        assert temp_db_dir.exists()

    def test_write_version_list_includes_bundle_hash_when_provided(self, db_writer, temp_db_dir):
        versions = [Version("2.0.0"), Version("1.0.0")]

        db_writer.write_version_list(versions, {Version("2.0.0"): "hashA", Version("1.0.0"): "hashB"})

        with open(temp_db_dir / "versions-index.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["versions"][0]["bundle_hash"] == "hashA"
        assert data["versions"][1]["bundle_hash"] == "hashB"

    def test_write_version_list_omits_bundle_hash_when_absent(self, db_writer, temp_db_dir):
        # No map (old behavior) and a partial map both omit the field cleanly.
        db_writer.write_version_list([Version("2.0.0"), Version("1.0.0")], {Version("2.0.0"): "hashA"})

        with open(temp_db_dir / "versions-index.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["versions"][0]["bundle_hash"] == "hashA"
        assert "bundle_hash" not in data["versions"][1]


class TestWriteVersionBundle:
    def test_writes_bundle_and_returns_hash(self, db_writer, temp_db_dir):
        entries = [
            {"name": "lib1", "has_spans": True, "has_metrics": False, "_is_custom": False},
            {"name": "lib2", "has_spans": False, "has_metrics": True, "_is_custom": False},
        ]

        bundle_hash = db_writer.write_version_bundle(Version("2.0.0"), entries)

        assert isinstance(bundle_hash, str)
        assert len(bundle_hash) == 12
        bundle_file = temp_db_dir / "bundles" / f"2.0.0-{bundle_hash}.json"
        assert bundle_file.exists()
        with open(bundle_file, "r", encoding="utf-8") as f:
            assert json.load(f) == entries

    def test_is_idempotent(self, db_writer):
        entries = [{"name": "lib1", "has_spans": True, "has_metrics": False, "_is_custom": False}]

        first = db_writer.write_version_bundle(Version("2.0.0"), entries)
        files_after_first = db_writer.files_written
        second = db_writer.write_version_bundle(Version("2.0.0"), entries)

        assert first == second
        # The second write is skipped because the content-addressed file exists.
        assert db_writer.files_written == files_after_first

    def test_empty_raises(self, db_writer):
        with pytest.raises(ValueError, match="Bundle instrumentations cannot be empty"):
            db_writer.write_version_bundle(Version("2.0.0"), [])


class TestGetStats:
    def test_get_stats_initial_state(self, db_writer):
        stats = db_writer.get_stats()
        assert stats["files_written"] == 0
        assert stats["total_bytes"] == 0

    def test_get_stats_after_writing_libraries(self, db_writer, sample_libraries):
        db_writer.write_libraries(sample_libraries)
        stats = db_writer.get_stats()

        assert stats["files_written"] == 2
        assert stats["total_bytes"] > 0

    def test_get_stats_after_version_index(self, db_writer):
        library_map = {"lib1": "abc123"}
        db_writer.write_version_index(Version("1.0.0"), library_map)

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0

    def test_get_stats_after_version_list(self, db_writer):
        versions = [Version("1.0.0")]
        db_writer.write_version_list(versions)

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0

    def test_get_stats_cumulative(self, db_writer, sample_libraries):
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
        assert not temp_db_dir.exists()

        db_writer.clean()

        assert temp_db_dir.exists()
        assert temp_db_dir.is_dir()

    def test_clean_with_nested_structure(self, db_writer, temp_db_dir):
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


class TestWriteMarkdown:
    """Tests for markdown file writing."""

    def test_write_markdown_success(self, db_writer, temp_db_dir):
        library_name = "test-lib"
        markdown_hash = "abc123def456"
        content = "# Test README"

        db_writer.write_markdown(library_name, markdown_hash, content)

        # Verify file creation
        markdown_file = temp_db_dir / "markdown" / f"{library_name}-{markdown_hash}.md"
        assert markdown_file.exists()
        assert markdown_file.read_text(encoding="utf-8") == content

        # Verify stats
        assert db_writer.files_written == 1
        assert db_writer.total_bytes == len(content.encode("utf-8"))

    def test_write_markdown_deduplication(self, db_writer, temp_db_dir, caplog):
        import logging

        caplog.set_level(logging.DEBUG)

        library_name = "test-lib"
        markdown_hash = "abc123def456"
        content = "# Test README"

        # Write first time
        db_writer.write_markdown(library_name, markdown_hash, content)
        assert db_writer.files_written == 1

        # Write second time (same content)
        db_writer.write_markdown(library_name, markdown_hash, content)

        # Stats should not increase
        assert db_writer.files_written == 1
        assert "already exists, skipping write" in caplog.text

    def test_write_markdown_error_handling(self, db_writer):
        from unittest.mock import patch

        with patch("builtins.open", side_effect=OSError("Disk full")):
            with patch("explorer_db_builder.database_writer.logger") as mock_logger:
                db_writer.write_markdown("error-lib", "hash", "content")

                # Verify error was logged
                mock_logger.error.assert_called()
                args, _ = mock_logger.error.call_args
                assert "Failed to write markdown" in args[0]


@pytest.fixture
def sample_index_instrumentations():
    return [
        {
            "name": "spring-webmvc-6.0",
            "display_name": "Spring Web MVC",
            "description": "Spring Web MVC instrumentation",
            "has_standalone_library": True,
            "library_link": "https://spring.io/projects/spring-framework",
            "source_path": "instrumentation/spring/spring-webmvc-6.0",
            "minimum_java_version": 17,
            "javaagent_target_versions": ["org.springframework:spring-webmvc:[6.0,)"],
            "telemetry": [
                {
                    "when": "default",
                    "spans": [{"span_kind": "SERVER"}],
                    "metrics": [
                        {
                            "name": "http.server.request.duration",
                            "description": "Duration of HTTP server requests.",
                            "instrument": "histogram",
                            "data_type": "HISTOGRAM",
                            "unit": "s",
                        }
                    ],
                }
            ],
            # Heavy fields that must NOT leak into the index:
            "configurations": [{"name": "otel.x", "type": "boolean"}],
            "scope": {"name": "io.opentelemetry.spring-webmvc-6.0"},
        },
        {
            "name": "akka-http-10.0",
            "display_name": "Akka HTTP",
            "description": "Akka HTTP instrumentation",
            "has_standalone_library": False,
            # No telemetry key -> has_telemetry should be False; search_terms empty.
        },
    ]


class TestWriteIndex:
    def test_write_index_creates_file(self, db_writer, sample_index_instrumentations, temp_db_dir):
        db_writer.write_index(sample_index_instrumentations)
        assert (temp_db_dir / "index.json").exists()

    def test_write_index_shape(self, db_writer, sample_index_instrumentations, temp_db_dir):
        db_writer.write_index(sample_index_instrumentations)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        assert data["ecosystem"] == "javaagent"
        assert isinstance(data["components"], list)
        assert len(data["components"]) == 2

    def test_write_index_sorted_by_name(self, db_writer, sample_index_instrumentations, temp_db_dir):
        db_writer.write_index(sample_index_instrumentations)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        names = [c["name"] for c in data["components"]]
        assert names == ["akka-http-10.0", "spring-webmvc-6.0"]

    def test_write_index_lightweight_fields_only(self, db_writer, sample_index_instrumentations, temp_db_dir):
        db_writer.write_index(sample_index_instrumentations)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        spring = next(c for c in data["components"] if c["name"] == "spring-webmvc-6.0")
        assert set(spring.keys()) == {
            "name",
            "display_name",
            "description",
            "has_telemetry",
            "has_standalone_library",
            "search_terms",
        }
        # Heavy fields must not be present in the index entry.
        assert "configurations" not in spring
        assert "scope" not in spring

    def test_write_index_derives_booleans(self, db_writer, sample_index_instrumentations, temp_db_dir):
        db_writer.write_index(sample_index_instrumentations)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        spring = next(c for c in data["components"] if c["name"] == "spring-webmvc-6.0")
        akka = next(c for c in data["components"] if c["name"] == "akka-http-10.0")

        assert spring["has_telemetry"] is True
        assert spring["has_standalone_library"] is True
        assert akka["has_telemetry"] is False
        assert akka["has_standalone_library"] is False

    def test_write_index_search_terms_sorted_deduped_and_populated(
        self, db_writer, sample_index_instrumentations, temp_db_dir
    ):
        db_writer.write_index(sample_index_instrumentations)
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        spring = next(c for c in data["components"] if c["name"] == "spring-webmvc-6.0")
        akka = next(c for c in data["components"] if c["name"] == "akka-http-10.0")

        terms = spring["search_terms"]
        # Sorted + deduped: the determinism contract for the content hash.
        assert terms == sorted(set(terms))
        # Distinctive identifiers flow in.
        assert "io.opentelemetry.spring-webmvc-6.0" in terms  # scope.name
        assert "org.springframework:spring-webmvc" in terms  # coordinate, range stripped
        assert "otel.x" in terms  # config name
        assert "http.server.request.duration" in terms  # metric name
        assert "Duration of HTTP server requests." in terms  # metric description
        # Noise and seeded fields stay out.
        assert "https://spring.io/projects/spring-framework" not in terms  # library_link
        assert "17" not in terms  # minimum_java_version
        assert "s" not in terms  # metric unit
        assert "org.springframework:spring-webmvc:[6.0,)" not in terms  # unstripped
        assert "Spring Web MVC" not in terms  # display_name (frontend indexes it)
        # No-telemetry entry degrades to an empty list, never a crash or a None.
        assert akka["search_terms"] == []

    def test_write_index_skips_items_without_name(self, db_writer, temp_db_dir):
        db_writer.write_index(
            [
                {"name": "valid-1.0", "display_name": "Valid"},
                {"display_name": "no name here"},
                "not a dict",
            ]
        )
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        assert [c["name"] for c in data["components"]] == ["valid-1.0"]

    def test_write_index_empty_list(self, db_writer, temp_db_dir):
        db_writer.write_index([])
        with open(temp_db_dir / "index.json") as f:
            data = json.load(f)

        assert data == {"ecosystem": "javaagent", "components": []}

    def test_write_index_updates_stats(self, db_writer, sample_index_instrumentations):
        db_writer.write_index(sample_index_instrumentations)
        assert db_writer.files_written == 1
        assert db_writer.total_bytes > 0


class TestWriteGlobalConfigurations:
    def test_writes_deterministic_file(self, db_writer, temp_db_dir):
        """Serialization is exactly json.dumps(indent=2, sort_keys=True) with no trailing newline."""
        configurations = [
            {"name": "otel.a", "type": "list", "instrumentations": ["jdbc"]},
            {"name": "otel.b", "type": "string", "instrumentations": ["servlet-5.0"]},
        ]

        db_writer.write_global_configurations(configurations)

        raw = (temp_db_dir / "global-configurations.json").read_text(encoding="utf-8")
        assert raw == json.dumps(configurations, indent=2, sort_keys=True)
        assert not raw.endswith("\n")

    def test_counts_bytes_in_stats(self, db_writer):
        """The write increments files_written and total_bytes."""
        db_writer.write_global_configurations([{"name": "otel.a", "instrumentations": []}])

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0

    def test_empty_list_writes_empty_array(self, db_writer, temp_db_dir):
        """An empty configuration list still writes a valid empty-array file."""
        db_writer.write_global_configurations([])

        assert json.loads((temp_db_dir / "global-configurations.json").read_text(encoding="utf-8")) == []


class TestWriteEcosystemStats:
    def test_writes_deterministic_file(self, db_writer, temp_db_dir):
        """Serialization is exactly json.dumps(indent=2, sort_keys=True) with no trailing newline."""
        stats = {"version_count": 5, "library_count": 253}

        db_writer.write_ecosystem_stats(stats)

        raw = (temp_db_dir / "ecosystem-stats.json").read_text(encoding="utf-8")
        assert raw == json.dumps(stats, indent=2, sort_keys=True)
        assert not raw.endswith("\n")

    def test_writes_expected_shape(self, db_writer, temp_db_dir):
        db_writer.write_ecosystem_stats({"version_count": 5, "library_count": 253})

        data = json.loads((temp_db_dir / "ecosystem-stats.json").read_text(encoding="utf-8"))
        assert data == {"version_count": 5, "library_count": 253}

    def test_counts_bytes_in_stats(self, db_writer):
        """The write increments files_written and total_bytes."""
        db_writer.write_ecosystem_stats({"version_count": 1, "library_count": 1})

        stats = db_writer.get_stats()
        assert stats["files_written"] == 1
        assert stats["total_bytes"] > 0
