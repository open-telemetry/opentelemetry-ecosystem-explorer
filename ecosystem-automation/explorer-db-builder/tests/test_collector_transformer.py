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
"""Tests for collector_transformer module."""

from explorer_db_builder.collector_transformer import (
    make_index_component,
    transform_collector_components,
)


def _make_inventory(
    distribution="contrib", version="0.150.0", repository="opentelemetry-collector-contrib", components=None
):
    return {
        "distribution": distribution,
        "version": version,
        "repository": repository,
        "components": components or {t: [] for t in ["connector", "exporter", "extension", "processor", "receiver"]},
    }


class TestTransformCollectorComponents:
    def test_basic_receiver(self):
        inventory = _make_inventory(
            components={
                "receiver": [
                    {
                        "name": "otlpreceiver",
                        "metadata": {
                            "type": "otlp",
                            "display_name": "OTLP Receiver",
                            "description": "Receives OTLP data.",
                            "status": {
                                "class": "receiver",
                                "stability": {"beta": ["traces", "metrics", "logs"]},
                                "distributions": ["core", "contrib"],
                            },
                        },
                    }
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 1
        component = result[0]
        assert component["id"] == "contrib-otlpreceiver"
        assert component["ecosystem"] == "collector"
        assert component["distribution"] == "contrib"
        assert component["type"] == "receiver"
        assert component["name"] == "otlpreceiver"
        assert component["display_name"] == "OTLP Receiver"
        assert component["description"] == "Receives OTLP data."
        assert component["repository"] == "opentelemetry-collector-contrib"
        assert "status" in component

    def test_all_component_types(self):
        components = {
            "receiver": [{"name": "myreceiver", "metadata": {"status": {}}}],
            "processor": [{"name": "myprocessor", "metadata": {"status": {}}}],
            "exporter": [{"name": "myexporter", "metadata": {"status": {}}}],
            "connector": [{"name": "myconnector", "metadata": {"status": {}}}],
            "extension": [{"name": "myextension", "metadata": {"status": {}}}],
        }
        inventory = _make_inventory(components=components)

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 5
        types = {c["type"] for c in result}
        assert types == {"receiver", "processor", "exporter", "connector", "extension"}

    def test_missing_optional_fields(self):
        inventory = _make_inventory(
            components={
                "receiver": [{"name": "minimalreceiver", "metadata": {"status": {}}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "core")

        assert len(result) == 1
        component = result[0]
        assert component["display_name"] is None
        assert component["description"] is None
        assert "attributes" not in component
        assert "metrics" not in component

    def test_attributes_and_metrics_included(self):
        inventory = _make_inventory(
            components={
                "receiver": [
                    {
                        "name": "richreceiver",
                        "metadata": {
                            "status": {},
                            "attributes": {"attr1": {"description": "desc", "type": "string"}},
                            "metrics": {"metric.one": {"description": "m1", "unit": "s"}},
                        },
                    }
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 1
        component = result[0]
        assert "attributes" in component
        assert "attr1" in component["attributes"]
        assert "metrics" in component
        assert "metric.one" in component["metrics"]

    def test_id_format(self):
        inventory = _make_inventory(
            distribution="core",
            components={
                "receiver": [{"name": "nopreceiver", "metadata": {"status": {}}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        )

        result = transform_collector_components(inventory, "core")

        assert result[0]["id"] == "core-nopreceiver"

    def test_skips_non_dict_components(self, caplog):
        inventory = _make_inventory(
            components={
                "receiver": ["not-a-dict", {"name": "validreceiver", "metadata": {"status": {}}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 1
        assert result[0]["name"] == "validreceiver"

    def test_skips_components_without_name(self, caplog):
        inventory = _make_inventory(
            components={
                "receiver": [
                    {"metadata": {"status": {}}},
                    {"name": "validreceiver", "metadata": {"status": {}}},
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 1
        assert result[0]["name"] == "validreceiver"

    def test_empty_components(self):
        inventory = _make_inventory()
        result = transform_collector_components(inventory, "core")
        assert result == []

    def test_multiple_components_per_type(self):
        inventory = _make_inventory(
            components={
                "receiver": [
                    {"name": "receiver_a", "metadata": {"status": {}}},
                    {"name": "receiver_b", "metadata": {"status": {}}},
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert len(result) == 2
        ids = {c["id"] for c in result}
        assert ids == {"contrib-receiver_a", "contrib-receiver_b"}

    def test_repository_from_inventory(self):
        inventory = _make_inventory(
            repository="my-custom-repo",
            components={
                "receiver": [{"name": "myreceiver", "metadata": {"status": {}}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        )

        result = transform_collector_components(inventory, "contrib")

        assert result[0]["repository"] == "my-custom-repo"


class TestMakeIndexComponent:
    def test_extracts_lightweight_fields(self):
        component = {
            "id": "contrib-otlp",
            "ecosystem": "collector",
            "distribution": "contrib",
            "type": "receiver",
            "name": "otlpreceiver",
            "display_name": "OTLP Receiver",
            "description": "Receives data.",
            "repository": "opentelemetry-collector-contrib",
            "status": {
                "stability": {"beta": ["traces", "metrics"]},
            },
            "attributes": {"attr1": {}},
            "metrics": {"m1": {}},
        }

        result = make_index_component(component)

        assert result["id"] == "contrib-otlp"
        assert result["name"] == "otlpreceiver"
        assert result["distribution"] == "contrib"
        assert result["type"] == "receiver"
        assert result["display_name"] == "OTLP Receiver"
        assert result["description"] == "Receives data."
        assert result["stability"] == "beta"
        assert result["signals"] == ["traces", "metrics"]
        # heavy fields should be absent
        assert "repository" not in result
        assert "attributes" not in result
        assert "metrics" not in result
        assert "ecosystem" not in result

    def test_stability_highest_level(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {
                "stability": {
                    "development": ["profiles"],
                    "alpha": ["logs"],
                    "beta": ["metrics"],
                    "stable": ["traces"],
                },
            },
        }
        result = make_index_component(component)
        assert result["stability"] == "stable"

    def test_stability_none_when_missing(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {},
        }
        result = make_index_component(component)
        assert result["stability"] is None

    def test_stability_single_level(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {"stability": {"alpha": ["metrics"]}},
        }
        result = make_index_component(component)
        assert result["stability"] == "alpha"


class TestMakeIndexComponentSignals:
    def test_signals_dedupe_and_canonical_order(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {
                "stability": {
                    "beta": ["metrics", "traces"],
                    "alpha": ["profiles", "metrics"],
                },
            },
        }
        result = make_index_component(component)
        assert result["signals"] == ["traces", "metrics", "profiles"]

    def test_signals_single_signal(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {"stability": {"alpha": ["metrics"]}},
        }
        result = make_index_component(component)
        assert result["signals"] == ["metrics"]

    def test_signals_empty_when_stability_missing(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {},
        }
        result = make_index_component(component)
        assert result["signals"] == []

    def test_signals_unknown_signal_appended_alphabetically(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {"stability": {"alpha": ["metrics", "zsignal", "asignal"]}},
        }
        result = make_index_component(component)
        assert result["signals"] == ["metrics", "asignal", "zsignal"]


class TestTransformCollectorComponentsReadmes:
    def test_stamps_markdown_hash_when_name_in_readme_map(self):
        inventory = _make_inventory(
            components={
                "receiver": [{"name": "otlpreceiver", "metadata": {"display_name": "OTLP Receiver"}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib", readme_map={"otlpreceiver": "abc123def456"})

        assert result[0]["markdown_hash"] == "abc123def456"

    def test_no_markdown_hash_when_name_not_in_readme_map(self):
        inventory = _make_inventory(
            components={
                "receiver": [{"name": "otlpreceiver", "metadata": {"display_name": "OTLP Receiver"}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib", readme_map={"someotherreceiver": "abc123def456"})

        assert "markdown_hash" not in result[0]

    def test_no_markdown_hash_when_readme_map_omitted(self):
        """readme_map is optional - callers that don't pass it get the old behavior."""
        inventory = _make_inventory(
            components={
                "receiver": [{"name": "otlpreceiver", "metadata": {"display_name": "OTLP Receiver"}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib")

        assert "markdown_hash" not in result[0]

    def test_only_matching_components_get_stamped(self):
        inventory = _make_inventory(
            components={
                "receiver": [
                    {"name": "otlpreceiver", "metadata": {"display_name": "OTLP"}},
                    {"name": "prometheusreceiver", "metadata": {"display_name": "Prometheus"}},
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            }
        )

        result = transform_collector_components(inventory, "contrib", readme_map={"otlpreceiver": "abc123def456"})

        by_name = {c["name"]: c for c in result}
        assert by_name["otlpreceiver"]["markdown_hash"] == "abc123def456"
        assert "markdown_hash" not in by_name["prometheusreceiver"]


class TestMakeIndexComponentHasReadme:
    def test_has_readme_true_when_markdown_hash_present(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {},
            "markdown_hash": "abc123def456",
        }
        result = make_index_component(component)
        assert result["has_readme"] is True

    def test_has_readme_false_when_markdown_hash_absent(self):
        component = {
            "id": "x",
            "name": "x",
            "distribution": "contrib",
            "type": "receiver",
            "display_name": None,
            "description": None,
            "status": {},
        }
        result = make_index_component(component)
        assert result["has_readme"] is False
