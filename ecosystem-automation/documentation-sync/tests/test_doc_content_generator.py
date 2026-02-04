"""Tests for documentation generator."""

from typing import Any, cast

import pytest
from documentation_sync.doc_content_generator import DocContentGenerator
from documentation_sync.metadata_diagnostics import MetadataDiagnostics


@pytest.fixture
def doc_generator():
    return DocContentGenerator(MetadataDiagnostics())


class TestGetStabilityBySignal:
    def test_get_stability_single_signal_beta(self, doc_generator):
        metadata = {"status": {"stability": {"beta": ["metrics"]}}}
        result = doc_generator.get_stability_by_signal(metadata)
        assert result == {"metrics": "beta"}

    def test_get_stability_multiple_signals_different_levels(self, doc_generator):
        metadata = {"status": {"stability": {"beta": ["traces", "metrics"], "alpha": ["logs"]}}}
        result = doc_generator.get_stability_by_signal(metadata)
        assert result == {"traces": "beta", "metrics": "beta", "logs": "alpha"}

    def test_get_stability_handles_missing_data(self, doc_generator):
        assert doc_generator.get_stability_by_signal({}) == {}
        assert doc_generator.get_stability_by_signal(cast(Any, None)) == {}
        assert doc_generator.get_stability_by_signal({"status": {}}) == {}
        assert doc_generator.get_stability_by_signal({"status": {"stability": {}}}) == {}


class TestIsUnmaintained:
    def test_is_unmaintained_with_unmaintained_stability(self, doc_generator):
        component = {
            "name": "oldreceiver",
            "metadata": {"status": {"stability": {"unmaintained": ["metrics"]}}},
        }
        assert doc_generator._is_unmaintained(component) is True

    def test_is_unmaintained_with_normal_stability(self, doc_generator):
        component = {
            "name": "activereceiver",
            "metadata": {"status": {"stability": {"beta": ["traces", "metrics"]}}},
        }
        assert doc_generator._is_unmaintained(component) is False

    def test_is_unmaintained_handles_missing_data(self, doc_generator):
        assert doc_generator._is_unmaintained({"name": "somereceiver", "metadata": {"status": {}}}) is False
        assert doc_generator._is_unmaintained({"name": "somereceiver"}) is False

    def test_is_unmaintained_multiple_stability_levels(self, doc_generator):
        component = {
            "name": "oldreceiver",
            "metadata": {
                "status": {
                    "stability": {
                        "beta": ["traces"],
                        "unmaintained": ["metrics"],
                    }
                }
            },
        }
        assert doc_generator._is_unmaintained(component) is True


class TestGenerateComponentTable:
    def test_generate_component_table_receiver(self, doc_generator):
        components = [
            {
                "name": "otlpreceiver",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces", "metrics", "logs"]},
                        "distributions": ["contrib"],
                    }
                },
            },
            {
                "name": "jaegerreceiver",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces"]},
                        "distributions": ["contrib"],
                    }
                },
            },
        ]

        table_content = doc_generator.generate_component_table("receiver", components)

        assert "| Name | Distributions[^1] | Traces[^2] | Metrics[^2] | Logs[^2] |" in table_content
        assert "[^1]:" in table_content
        assert "[^2]:" in table_content

        assert (
            "| [jaegerreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/receiver/jaegerreceiver) | contrib | beta | - | - |"
            in table_content
        )
        assert (
            "| [otlpreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/receiver/otlpreceiver) | contrib | beta | beta | beta |"
            in table_content
        )

    def test_generate_component_table_extension_with_single_column(self, doc_generator):
        components = [
            {
                "name": "healthcheckextension",
                "metadata": {"status": {"stability": {"beta": ["extension"]}, "distributions": ["contrib"]}},
            }
        ]

        table_content = doc_generator.generate_component_table("extension", components)

        assert "| Name | Distributions[^1] | Stability[^2] |" in table_content
        assert "[^1]:" in table_content
        assert "[^2]:" in table_content

        assert (
            "| [healthcheckextension]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/extension/healthcheckextension) | contrib | beta |"
            in table_content
        )

    def test_generate_component_table_connector_without_stability(self, doc_generator):
        components = [
            {
                "name": "spanmetricsconnector",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces_to_metrics"]},
                        "distributions": ["contrib"],
                    }
                },
            },
            {
                "name": "countconnector",
                "source_repo": "contrib",
                "metadata": {
                    "status": {
                        "stability": {"alpha": ["metrics_to_metrics"]},
                        "distributions": ["contrib"],
                    }
                },
            },
        ]

        table_content = doc_generator.generate_component_table("connector", components)

        # Should have simplified header without stability columns
        assert "| Name | Distributions[^1] |" in table_content
        # Should not have Traces/Metrics/Logs columns
        assert "Traces[^2]" not in table_content
        assert "Metrics[^2]" not in table_content
        assert "Logs[^2]" not in table_content

        # Should have distributions footnote but not stability footnote
        assert "[^1]:" in table_content
        assert "[^2]:" not in table_content

        # Should not have unmaintained note since connectors don't show stability
        assert "⚠️ **Note:** Components marked with ⚠️ are unmaintained" not in table_content

        # Should have component rows with only name and distributions
        assert (
            "| [countconnector](https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/connector/countconnector) | contrib |" in table_content
        )
        assert (
            "| [spanmetricsconnector]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector) | contrib |" in table_content
        )

    def test_generate_component_table_with_distributions(self, doc_generator):
        """Test that distributions column shows correct values."""
        components = [
            {
                "name": "otlpreceiver",
                "source_repo": "core",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces", "metrics", "logs"]},
                        "distributions": ["core"],
                    }
                },
            },
            {
                "name": "jaegerreceiver",
                "source_repo": "contrib",
                "metadata": {"status": {"stability": {"beta": ["traces"]}, "distributions": ["contrib"]}},
            },
            {
                "name": "zipkinreceiver",
                "source_repo": "core",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces"]},
                        "distributions": ["contrib", "core"],
                    }
                },
            },
        ]

        table_content = doc_generator.generate_component_table("receiver", components)

        assert (
            "[otlpreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector/tree/main/receiver/otlpreceiver) | core |" in table_content
        )
        assert (
            "[jaegerreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/receiver/jaegerreceiver) | contrib |" in table_content
        )
        assert (
            "[zipkinreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector/tree/main/receiver/zipkinreceiver) | contrib, core |" in table_content
        )

    def test_format_distributions_capitalizes_k8s(self, doc_generator):
        """Test that k8s is capitalized to K8s to match textlint terminology rules."""
        component = {
            "name": "countconnector",
            "source_repo": "contrib",
            "metadata": {
                "status": {
                    "distributions": ["contrib", "k8s"],
                }
            },
        }

        table_content = doc_generator.generate_component_table("connector", [component])

        assert "contrib, K8s" in table_content
        assert "contrib, k8s" not in table_content

    def test_generate_component_table_sorting_alphabetically(self, doc_generator):
        components = [
            {
                "name": "zreceiver",
                "metadata": {"status": {"stability": {"beta": ["traces"]}, "distributions": ["contrib"]}},
            },
            {
                "name": "areceiver",
                "metadata": {"status": {"stability": {"alpha": ["metrics"]}, "distributions": ["contrib"]}},
            },
            {
                "name": "mreceiver",
                "metadata": {"status": {"stability": {"beta": ["logs"]}, "distributions": ["contrib"]}},
            },
        ]

        table_content = doc_generator.generate_component_table("receiver", components)

        a_pos = table_content.find("| [areceiver]")
        m_pos = table_content.find("| [mreceiver]")
        z_pos = table_content.find("| [zreceiver]")

        # Verify alphabetical order
        assert a_pos < m_pos < z_pos

    def test_generate_component_table_no_metadata(self, doc_generator):
        components = [{"name": "fooprocessor"}]

        table_content = doc_generator.generate_component_table("processor", components)

        assert (
            "| [fooprocessor]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/processor/fooprocessor) | contrib | - | - | - |" in table_content
        )

    def test_generate_component_table_unmaintained_component(self, doc_generator):
        """Test that unmaintained components get a warning emoji."""
        components = [
            {
                "name": "oldreceiver",
                "metadata": {
                    "status": {
                        "stability": {"unmaintained": ["metrics"]},
                        "distributions": ["contrib"],
                    }
                },
            },
            {
                "name": "activereceiver",
                "metadata": {
                    "status": {
                        "stability": {"beta": ["traces"]},
                        "distributions": ["contrib"],
                    }
                },
            },
        ]

        table_content = doc_generator.generate_component_table("receiver", components)

        # Unmaintained component should have emoji
        assert "[oldreceiver]" in table_content
        assert "oldreceiver) ⚠️" in table_content

        # Active component should not have emoji
        assert "[activereceiver]" in table_content
        assert "activereceiver) ⚠️" not in table_content

    def test_generate_component_table_unmaintained_connector(self, doc_generator):
        """Test that unmaintained connectors don't get warning emoji (since stability isn't shown)."""
        components = [
            {
                "name": "oldconnector",
                "metadata": {
                    "status": {
                        "stability": {"unmaintained": ["traces_to_metrics"]},
                        "distributions": ["contrib"],
                    }
                },
            }
        ]

        table_content = doc_generator.generate_component_table("connector", components)

        # Should NOT have emoji for connectors
        assert "oldconnector) ⚠️" not in table_content
        # Should NOT have unmaintained note for connectors
        assert "⚠️ **Note:**" not in table_content


class TestGenerateAllComponentTables:
    def test_generate_all_component_tables(self, doc_generator):
        inventory = {
            "components": {
                "receiver": [
                    {
                        "name": "otlpreceiver",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["traces", "metrics", "logs"]},
                                "distributions": ["contrib"],
                            }
                        },
                    }
                ],
                "processor": [
                    {
                        "name": "batchprocessor",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["traces", "metrics", "logs"]},
                                "distributions": ["contrib"],
                            }
                        },
                    }
                ],
                "exporter": [],
                "connector": [],
                "extension": [
                    {
                        "name": "healthcheckextension",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    }
                ],
            }
        }

        tables = doc_generator.generate_all_component_tables(inventory)

        # Should return dict with all component types plus extension-footnotes
        assert len(tables) == 6
        assert "receiver" in tables
        assert "processor" in tables
        assert "exporter" in tables
        assert "connector" in tables
        assert "extension" in tables
        assert "extension-footnotes" in tables

        # Check receiver table content
        receiver_table = tables["receiver"]
        assert "| Name | Distributions[^1] | Traces[^2] | Metrics[^2] | Logs[^2] |" in receiver_table
        assert (
            "| [otlpreceiver]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/receiver/otlpreceiver) | contrib | beta | beta | beta |"
            in receiver_table
        )

        # Check extension table content
        extension_table = tables["extension"]
        assert "| Name | Distributions[^1] | Stability[^2] |" in extension_table
        assert (
            "| [healthcheckextension]("
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/extension/healthcheckextension) | contrib | beta |"
            in extension_table
        )

    def test_generate_all_component_tables_empty_inventory(self, doc_generator):
        inventory = {"components": {}}

        tables = doc_generator.generate_all_component_tables(inventory)

        # Should still return all component types with empty tables plus extension-footnotes
        assert len(tables) == 6
        assert "receiver" in tables
        assert "processor" in tables
        assert "exporter" in tables
        assert "connector" in tables
        assert "extension" in tables
        assert "extension-footnotes" in tables

        # Each table should have structure but no components
        for table_key, table in tables.items():
            # extension-footnotes doesn't have table structure
            if table_key == "extension-footnotes":
                assert "[^1]:" in table
                assert "[^2]:" in table
            # extension tables don't have footnotes (footnotes are separate)
            elif table_key.startswith("extension"):
                assert "| Name |" in table
                assert "[^1]:" not in table
            else:
                assert "| Name |" in table
                assert "[^1]:" in table
                # Connectors don't have stability footnote
                if table_key != "connector":
                    assert "[^2]:" in table
                else:
                    assert "[^2]:" not in table


class TestExtensionSubtypes:
    def test_filter_by_subtype_returns_only_matching(self, doc_generator):
        components = [
            {"name": "healthcheckextension", "metadata": {}},
            {"name": "otlpencodingextension", "subtype": "encoding", "metadata": {}},
            {"name": "jsonlogencodingextension", "subtype": "encoding", "metadata": {}},
            {"name": "hostobserver", "subtype": "observer", "metadata": {}},
        ]

        encoding = doc_generator._filter_by_subtype(components, "encoding")
        assert len(encoding) == 2
        assert all(c["subtype"] == "encoding" for c in encoding)

        observer = doc_generator._filter_by_subtype(components, "observer")
        assert len(observer) == 1
        assert observer[0]["name"] == "hostobserver"

    def test_filter_by_subtype_none_returns_components_without_subtype(self, doc_generator):
        components = [
            {"name": "healthcheckextension", "metadata": {}},
            {"name": "pprofextension", "metadata": {}},
            {"name": "otlpencodingextension", "subtype": "encoding", "metadata": {}},
        ]

        regular = doc_generator._filter_by_subtype(components, None)
        assert len(regular) == 2
        assert all(c.get("subtype") is None for c in regular)

    def test_generate_component_table_with_subtype_correct_path(self, doc_generator):
        components = [
            {
                "name": "otlpencodingextension",
                "subtype": "encoding",
                "metadata": {"status": {"stability": {"beta": ["extension"]}, "distributions": ["contrib"]}},
            }
        ]

        table = doc_generator.generate_component_table("extension", components, subtype="encoding")

        # Should have nested path: extension/encoding/otlpencodingextension
        assert (
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/extension/encoding/otlpencodingextension" in table
        )

    def test_generate_component_table_without_subtype_regular_path(self, doc_generator):
        """Test that regular extensions have non-nested paths."""
        components = [
            {
                "name": "healthcheckextension",
                "metadata": {"status": {"stability": {"beta": ["extension"]}, "distributions": ["contrib"]}},
            }
        ]

        table = doc_generator.generate_component_table("extension", components, subtype=None)

        # Should have regular path: extension/healthcheckextension
        assert (
            "https://github.com/open-telemetry/"
            "opentelemetry-collector-contrib/tree/main/extension/healthcheckextension" in table
        )
        # Should NOT have nested path
        assert "/extension/encoding/" not in table
        assert "/extension/observer/" not in table
        assert "/extension/storage/" not in table

    def test_generate_all_component_tables_includes_subtypes(self, doc_generator):
        inventory = {
            "components": {
                "receiver": [],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [
                    {
                        "name": "healthcheckextension",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                    {
                        "name": "otlpencodingextension",
                        "subtype": "encoding",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                    {
                        "name": "hostobserver",
                        "subtype": "observer",
                        "metadata": {
                            "status": {
                                "stability": {"alpha": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                    {
                        "name": "filestorage",
                        "subtype": "storage",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                ],
            }
        }

        tables = doc_generator.generate_all_component_tables(inventory)

        # Should have all standard tables plus subtype tables
        assert "receiver" in tables
        assert "processor" in tables
        assert "exporter" in tables
        assert "connector" in tables
        assert "extension" in tables  # Main extensions
        assert "extension-encoding" in tables
        assert "extension-observer" in tables
        assert "extension-storage" in tables

        # Main extension table should only have healthcheckextension
        assert "healthcheckextension" in tables["extension"]
        assert "otlpencodingextension" not in tables["extension"]
        assert "hostobserver" not in tables["extension"]
        assert "filestorage" not in tables["extension"]

        # Encoding table should have otlpencodingextension with nested path
        assert "otlpencodingextension" in tables["extension-encoding"]
        assert "/extension/encoding/otlpencodingextension" in tables["extension-encoding"]

        # Observer table should have hostobserver
        assert "hostobserver" in tables["extension-observer"]
        assert "/extension/observer/hostobserver" in tables["extension-observer"]

        # Storage table should have filestorage
        assert "filestorage" in tables["extension-storage"]
        assert "/extension/storage/filestorage" in tables["extension-storage"]

    def test_generate_all_component_tables_skips_empty_subtypes(self, doc_generator):
        """Test that empty subtype tables are still included but empty."""
        inventory = {
            "components": {
                "receiver": [],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [
                    {
                        "name": "healthcheckextension",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                    # No encoding/observer/storage extensions
                ],
            }
        }

        tables = doc_generator.generate_all_component_tables(inventory)

        # Should still have main extension table
        assert "extension" in tables
        assert "healthcheckextension" in tables["extension"]

        # Subtype tables should not be created if no components have that subtype
        assert "extension-encoding" not in tables
        assert "extension-observer" not in tables
        assert "extension-storage" not in tables

    def test_subtype_tables_have_no_footnotes(self, doc_generator):
        """Test that subtype tables don't include footnotes (footnotes are separate)."""
        inventory = {
            "components": {
                "receiver": [],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [
                    {
                        "name": "healthcheckextension",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                    {
                        "name": "otlpencodingextension",
                        "subtype": "encoding",
                        "metadata": {
                            "status": {
                                "stability": {"beta": ["extension"]},
                                "distributions": ["contrib"],
                            }
                        },
                    },
                ],
            }
        }

        tables = doc_generator.generate_all_component_tables(inventory)

        # Main extension table should NOT have footnotes (they're separate now)
        assert "[^1]:\n    Shows which [distributions]" not in tables["extension"]
        assert "[^2]:\n    For details about component stability levels" not in tables["extension"]

        # Encoding subtype table should NOT have footnotes
        assert "[^1]:\n    Shows which [distributions]" not in tables["extension-encoding"]
        assert "[^2]:\n    For details about component stability levels" not in tables["extension-encoding"]

        # Footnotes should be in the separate extension-footnotes section
        assert "[^1]:\n    Shows which [distributions]" in tables["extension-footnotes"]
        assert "[^2]:\n    For details about component stability levels" in tables["extension-footnotes"]

    def test_include_footnotes_parameter(self, doc_generator):
        """Test that include_footnotes parameter controls footnote generation."""
        components = [
            {
                "name": "testextension",
                "metadata": {"status": {"stability": {"beta": ["extension"]}, "distributions": ["contrib"]}},
            }
        ]

        # With footnotes (default)
        with_footnotes = doc_generator.generate_component_table("extension", components)
        assert "[^1]:\n    Shows which [distributions]" in with_footnotes
        assert "[^2]:\n    For details about component stability levels" in with_footnotes
        # No unmaintained note since no components are unmaintained
        assert "⚠️ **Note:**" not in with_footnotes

        # Without footnotes
        without_footnotes = doc_generator.generate_component_table("extension", components, include_footnotes=False)
        assert "[^1]:\n    Shows which [distributions]" not in without_footnotes
        assert "[^2]:\n    For details about component stability levels" not in without_footnotes
        assert "⚠️ **Note:**" not in without_footnotes

        # Both should still have the table content
        assert "testextension" in with_footnotes
        assert "testextension" in without_footnotes
