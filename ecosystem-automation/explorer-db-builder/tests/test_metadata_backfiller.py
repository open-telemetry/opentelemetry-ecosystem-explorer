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
"""Tests for metadata backfiller."""

from explorer_db_builder.metadata_backfiller import (
    BACKFILLABLE_FIELDS,
    backfill_metadata,
)
from semantic_version import Version


class TestBackfillMetadata:
    def test_backfill_missing_display_name_in_early_versions(self):
        """Backfills display_name from later version to earlier versions."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0"), Version("1.4.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http", "description": "Akka HTTP instrumentation"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http", "description": "Akka HTTP instrumentation"}],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http", "description": "Akka HTTP instrumentation"}],
            },
            Version("1.4.0"): {
                "file_format": 0.2,
                "libraries": [
                    {
                        "name": "akka-http",
                        "display_name": "Akka HTTP",
                        "description": "Akka HTTP instrumentation",
                    }
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Verify backfill applied to early versions
        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.3.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.4.0")]["libraries"][0]["display_name"] == "Akka HTTP"

    def test_changing_values_across_versions(self):
        """When values change, only backfill to the point of change."""
        versions = [
            Version("1.1.0"),
            Version("1.2.0"),
            Version("1.3.0"),
            Version("1.4.0"),
            Version("1.5.0"),
        ]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http"}],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http"}],
            },
            Version("1.4.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http", "display_name": "Akka HTTP"}],
            },
            Version("1.5.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http", "display_name": "Akka HTTP Client"}],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Early versions get first value
        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.3.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.4.0")]["libraries"][0]["display_name"] == "Akka HTTP"

        # Version with change gets new value
        assert result[Version("1.5.0")]["libraries"][0]["display_name"] == "Akka HTTP Client"

    def test_backfill_multiple_fields(self):
        """Backfills multiple fields independently."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "akka-http"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [
                    {
                        "name": "akka-http",
                        "display_name": "Akka HTTP",
                        "description": "HTTP server instrumentation",
                    }
                ],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [
                    {
                        "name": "akka-http",
                        "display_name": "Akka HTTP",
                        "description": "HTTP server instrumentation",
                        "library_link": "https://doc.akka.io/docs/akka-http/",
                    }
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Version 1.1.0 gets all fields backfilled
        lib_1_1 = result[Version("1.1.0")]["libraries"][0]
        assert lib_1_1["display_name"] == "Akka HTTP"
        assert lib_1_1["description"] == "HTTP server instrumentation"
        assert lib_1_1["library_link"] == "https://doc.akka.io/docs/akka-http/"

        # Version 1.2.0 gets library_link backfilled
        lib_1_2 = result[Version("1.2.0")]["libraries"][0]
        assert lib_1_2["display_name"] == "Akka HTTP"
        assert lib_1_2["description"] == "HTTP server instrumentation"
        assert lib_1_2["library_link"] == "https://doc.akka.io/docs/akka-http/"

        # Version 1.3.0 has all fields
        lib_1_3 = result[Version("1.3.0")]["libraries"][0]
        assert lib_1_3["display_name"] == "Akka HTTP"
        assert lib_1_3["description"] == "HTTP server instrumentation"
        assert lib_1_3["library_link"] == "https://doc.akka.io/docs/akka-http/"

    def test_library_appearing_mid_timeline(self):
        """Library appearing mid-timeline doesn't backfill to non-existent earlier versions."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "existing-lib", "display_name": "Existing"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "existing-lib", "display_name": "Existing"},
                    {"name": "new-lib"},
                ],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "existing-lib", "display_name": "Existing"},
                    {"name": "new-lib", "display_name": "New Library"},
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Version 1.1.0 doesn't have new-lib at all
        assert len(result[Version("1.1.0")]["libraries"]) == 1
        assert result[Version("1.1.0")]["libraries"][0]["name"] == "existing-lib"

        # Version 1.2.0 has new-lib with backfilled display_name
        assert len(result[Version("1.2.0")]["libraries"]) == 2
        assert result[Version("1.2.0")]["libraries"][1]["name"] == "new-lib"
        assert result[Version("1.2.0")]["libraries"][1]["display_name"] == "New Library"

        # Version 1.3.0 has new-lib with display_name
        assert result[Version("1.3.0")]["libraries"][1]["display_name"] == "New Library"

    def test_field_removal(self):
        """Field removed in later version is not backfilled beyond removal point."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib", "display_name": "Test Library"}],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib"}],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Version 1.1.0 gets backfilled
        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Test Library"

        # Version 1.2.0 has the field
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Test Library"

        # Version 1.3.0 doesn't have the field (was removed)
        assert "display_name" not in result[Version("1.3.0")]["libraries"][0]

    def test_empty_string_treated_as_missing(self):
        """Empty strings are treated as missing and backfilled."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib", "display_name": ""}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib", "display_name": "Test Library"}],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Empty string in 1.1.0 gets backfilled
        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Test Library"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Test Library"

    def test_preserves_other_fields(self):
        """Backfilling preserves all other fields in the library."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [
                    {
                        "name": "test-lib",
                        "source_path": "instrumentation/test-lib",
                        "javaagent_target_versions": ["com.test:lib:[1.0,)"],
                        "has_standalone_library": True,
                        "configurations": [{"name": "test.config", "type": "boolean"}],
                    }
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [
                    {
                        "name": "test-lib",
                        "display_name": "Test Library",
                        "source_path": "instrumentation/test-lib",
                        "javaagent_target_versions": ["com.test:lib:[1.0,)"],
                        "has_standalone_library": True,
                        "configurations": [{"name": "test.config", "type": "boolean"}],
                    }
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        lib = result[Version("1.1.0")]["libraries"][0]
        assert lib["name"] == "test-lib"
        assert lib["display_name"] == "Test Library"
        assert lib["source_path"] == "instrumentation/test-lib"
        assert lib["javaagent_target_versions"] == ["com.test:lib:[1.0,)"]
        assert lib["has_standalone_library"] is True
        assert lib["configurations"] == [{"name": "test.config", "type": "boolean"}]

    def test_multiple_libraries_backfilled_independently(self):
        """Each library's metadata is backfilled independently."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "lib-a"},
                    {"name": "lib-b"},
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "lib-a", "display_name": "Library A"},
                    {"name": "lib-b"},
                ],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "lib-a", "display_name": "Library A"},
                    {"name": "lib-b", "display_name": "Library B"},
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # Version 1.1.0: lib-a gets backfilled, lib-b gets backfilled
        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Library A"
        assert result[Version("1.1.0")]["libraries"][1]["display_name"] == "Library B"

        # Version 1.2.0: lib-a has value, lib-b gets backfilled
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Library A"
        assert result[Version("1.2.0")]["libraries"][1]["display_name"] == "Library B"

        # Version 1.3.0: both have values
        assert result[Version("1.3.0")]["libraries"][0]["display_name"] == "Library A"
        assert result[Version("1.3.0")]["libraries"][1]["display_name"] == "Library B"

    def test_no_backfill_when_no_future_value(self):
        """Fields remain missing if no future value exists."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib"}],
            },
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib"}],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # No backfill occurs since no future value exists
        assert "display_name" not in result[Version("1.1.0")]["libraries"][0]
        assert "display_name" not in result[Version("1.2.0")]["libraries"][0]

    def test_empty_versions_list(self):
        """Returns empty dict for empty versions list."""

        def load_fn(version):
            return {}

        result = backfill_metadata([], load_fn)

        assert result == {}

    def test_item_without_name_is_preserved(self):
        """Items without a name field are preserved without backfilling."""
        versions = [Version("1.1.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"description": "No name field"},
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        assert len(result[Version("1.1.0")]["libraries"]) == 1
        assert result[Version("1.1.0")]["libraries"][0]["description"] == "No name field"

    def test_backfillable_fields_constant(self):
        """Verify BACKFILLABLE_FIELDS contains expected fields."""
        assert "display_name" in BACKFILLABLE_FIELDS
        assert "description" in BACKFILLABLE_FIELDS
        assert "library_link" in BACKFILLABLE_FIELDS
        assert len(BACKFILLABLE_FIELDS) == 3
