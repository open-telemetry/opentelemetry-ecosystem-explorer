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

from explorer_db_builder.metadata_backfiller import backfill_metadata
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

        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.3.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.4.0")]["libraries"][0]["display_name"] == "Akka HTTP"
        assert result[Version("1.5.0")]["libraries"][0]["display_name"] == "Akka HTTP Client"

    def test_backfill_multiple_fields_and_libraries(self):
        """Backfills multiple fields independently across multiple libraries."""
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
                    {"name": "lib-b", "description": "Library B description"},
                ],
            },
            Version("1.3.0"): {
                "file_format": 0.2,
                "libraries": [
                    {"name": "lib-a", "display_name": "Library A"},
                    {
                        "name": "lib-b",
                        "display_name": "Library B",
                        "description": "Library B description",
                        "library_link": "https://example.com",
                    },
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        lib_a_1_1 = result[Version("1.1.0")]["libraries"][0]
        assert lib_a_1_1["display_name"] == "Library A"

        lib_b_1_1 = result[Version("1.1.0")]["libraries"][1]
        assert lib_b_1_1["display_name"] == "Library B"
        assert lib_b_1_1["description"] == "Library B description"
        assert lib_b_1_1["library_link"] == "https://example.com"

        lib_b_1_2 = result[Version("1.2.0")]["libraries"][1]
        assert lib_b_1_2["display_name"] == "Library B"
        assert lib_b_1_2["library_link"] == "https://example.com"

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

        assert len(result[Version("1.1.0")]["libraries"]) == 1
        assert result[Version("1.1.0")]["libraries"][0]["name"] == "existing-lib"

        assert len(result[Version("1.2.0")]["libraries"]) == 2
        assert result[Version("1.2.0")]["libraries"][1]["display_name"] == "New Library"

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

        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Test Library"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Test Library"
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

        assert result[Version("1.1.0")]["libraries"][0]["display_name"] == "Test Library"
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Test Library"

    def test_present_but_none_item_list_does_not_crash(self):
        """A present-but-None item list (malformed/partial inventory, since YAML
        `libraries:` parses as None) is normalized to [] instead of raising TypeError
        while iterating in _build_timelines / backfill_metadata."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {"file_format": 0.2, "libraries": None},
            Version("1.2.0"): {
                "file_format": 0.2,
                "libraries": [{"name": "test-lib", "display_name": "Test Library"}],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        # The None version yields an empty list; the populated version is unaffected.
        assert result[Version("1.1.0")]["libraries"] == []
        assert result[Version("1.2.0")]["libraries"][0]["display_name"] == "Test Library"

    def test_backfill_has_javaagent_boolean(self):
        """Backfills the has_javaagent boolean (including False) from later versions."""
        versions = [Version("1.1.0"), Version("1.2.0"), Version("1.3.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.3,
                "libraries": [
                    {"name": "agent-lib"},
                    {"name": "library-only"},
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.3,
                "libraries": [
                    {"name": "agent-lib"},
                    {"name": "library-only"},
                ],
            },
            Version("1.3.0"): {
                "file_format": 0.5,
                "libraries": [
                    {"name": "agent-lib", "has_javaagent": True},
                    {"name": "library-only", "has_javaagent": False},
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        assert result[Version("1.1.0")]["libraries"][0]["has_javaagent"] is True
        assert result[Version("1.1.0")]["libraries"][1]["has_javaagent"] is False
        assert result[Version("1.2.0")]["libraries"][0]["has_javaagent"] is True
        assert result[Version("1.2.0")]["libraries"][1]["has_javaagent"] is False
        assert result[Version("1.3.0")]["libraries"][0]["has_javaagent"] is True
        assert result[Version("1.3.0")]["libraries"][1]["has_javaagent"] is False

    def test_backfill_nested_configuration_fields(self):
        """Backfills declarative_name and examples within configurations across versions."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.3,
                "libraries": [
                    {
                        "name": "http-lib",
                        "configurations": [
                            {"name": "otel.http.known-methods", "type": "list"},
                            {"name": "otel.http.capture-headers", "type": "list"},
                        ],
                    }
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.5,
                "libraries": [
                    {
                        "name": "http-lib",
                        "configurations": [
                            {
                                "name": "otel.http.known-methods",
                                "declarative_name": "java.common.http.known_methods",
                                "type": "list",
                                "examples": ["GET,POST", "CONNECT,OPTIONS"],
                            },
                            {
                                "name": "otel.http.capture-headers",
                                "declarative_name": "java.common.http.capture_headers",
                                "type": "list",
                            },
                        ],
                    }
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        old_configs = result[Version("1.1.0")]["libraries"][0]["configurations"]
        assert old_configs[0]["declarative_name"] == "java.common.http.known_methods"
        assert old_configs[0]["examples"] == ["GET,POST", "CONNECT,OPTIONS"]
        assert old_configs[1]["declarative_name"] == "java.common.http.capture_headers"
        assert "examples" not in old_configs[1]

    def test_nested_backfill_isolates_per_library(self):
        """A configuration named the same in different libraries is not cross-contaminated."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.3,
                "libraries": [
                    {"name": "lib-a", "configurations": [{"name": "shared.option"}]},
                    {"name": "lib-b", "configurations": [{"name": "shared.option"}]},
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.5,
                "libraries": [
                    {
                        "name": "lib-a",
                        "configurations": [{"name": "shared.option", "declarative_name": "a.shared"}],
                    },
                    {
                        "name": "lib-b",
                        "configurations": [{"name": "shared.option", "declarative_name": "b.shared"}],
                    },
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        a_config = result[Version("1.1.0")]["libraries"][0]["configurations"][0]
        b_config = result[Version("1.1.0")]["libraries"][1]["configurations"][0]
        assert a_config["declarative_name"] == "a.shared"
        assert b_config["declarative_name"] == "b.shared"

    def test_empty_examples_list_is_backfilled(self):
        """An empty examples list is treated as missing and backfilled."""
        versions = [Version("1.1.0"), Version("1.2.0")]

        inventories = {
            Version("1.1.0"): {
                "file_format": 0.5,
                "libraries": [
                    {
                        "name": "lib-a",
                        "configurations": [{"name": "opt", "examples": []}],
                    }
                ],
            },
            Version("1.2.0"): {
                "file_format": 0.5,
                "libraries": [
                    {
                        "name": "lib-a",
                        "configurations": [{"name": "opt", "examples": ["one", "two"]}],
                    }
                ],
            },
        }

        def load_fn(version):
            return inventories[version]

        result = backfill_metadata(versions, load_fn)

        assert result[Version("1.1.0")]["libraries"][0]["configurations"][0]["examples"] == ["one", "two"]
