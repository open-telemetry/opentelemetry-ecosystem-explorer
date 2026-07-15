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
"""Tests for collector_display_name_audit module."""

import json

from explorer_db_builder.collector_display_name_audit import (
    find_missing_display_names,
    write_missing_display_name_report,
)


def _component(name, display_name="present", distribution="contrib", component_type="receiver"):
    return {
        "id": f"{distribution}-{name}",
        "ecosystem": "collector",
        "distribution": distribution,
        "type": component_type,
        "name": name,
        "display_name": display_name,
    }


class TestFindMissingDisplayNames:
    def test_none_display_name_is_missing(self):
        result = find_missing_display_names([_component("nopreceiver", display_name=None)])
        assert result == [
            {"id": "contrib-nopreceiver", "distribution": "contrib", "type": "receiver", "name": "nopreceiver"}
        ]

    def test_missing_key_is_missing(self):
        component = _component("nopreceiver")
        del component["display_name"]
        result = find_missing_display_names([component])
        assert [c["name"] for c in result] == ["nopreceiver"]

    def test_empty_string_is_missing(self):
        result = find_missing_display_names([_component("nopreceiver", display_name="")])
        assert [c["name"] for c in result] == ["nopreceiver"]

    def test_whitespace_only_is_missing(self):
        result = find_missing_display_names([_component("nopreceiver", display_name="   ")])
        assert [c["name"] for c in result] == ["nopreceiver"]

    def test_present_display_name_is_not_missing(self):
        result = find_missing_display_names([_component("otlpreceiver", display_name="OTLP Receiver")])
        assert result == []

    def test_only_missing_are_returned(self):
        components = [
            _component("otlpreceiver", display_name="OTLP Receiver"),
            _component("nopreceiver", display_name=None),
            _component("badexporter", display_name="", component_type="exporter"),
        ]
        result = find_missing_display_names(components)
        assert {c["name"] for c in result} == {"nopreceiver", "badexporter"}

    def test_sorted_by_id(self):
        components = [
            _component("zeta", display_name=None, distribution="core"),
            _component("alpha", display_name=None, distribution="core"),
            _component("mu", display_name=None, distribution="contrib"),
        ]
        result = find_missing_display_names(components)
        assert [c["id"] for c in result] == ["contrib-mu", "core-alpha", "core-zeta"]

    def test_slim_shape_only(self):
        result = find_missing_display_names([_component("nopreceiver", display_name=None)])
        assert set(result[0].keys()) == {"id", "distribution", "type", "name"}

    def test_ignores_experimental_core_placeholders(self):
        components = [
            _component("xconnector", display_name=None, distribution="core", component_type="connector"),
            _component("xexporter", display_name=None, distribution="core", component_type="exporter"),
            _component("xextension", display_name=None, distribution="core", component_type="extension"),
            _component("xprocessor", display_name=None, distribution="core", component_type="processor"),
            _component("xreceiver", display_name=None, distribution="core", component_type="receiver"),
            _component("realreceiver", display_name=None, distribution="core"),
        ]
        result = find_missing_display_names(components)
        assert [c["name"] for c in result] == ["realreceiver"]


class TestWriteMissingDisplayNameReport:
    def test_round_trips(self, tmp_path):
        missing = [{"id": "contrib-nopreceiver", "distribution": "contrib", "type": "receiver", "name": "nopreceiver"}]
        path = tmp_path / "report.json"

        write_missing_display_name_report(str(path), "0.151.0", missing)

        with open(path) as f:
            data = json.load(f)
        assert data == {"ecosystem": "collector", "version": "0.151.0", "missing": missing}

    def test_empty_missing_list(self, tmp_path):
        path = tmp_path / "report.json"

        write_missing_display_name_report(str(path), "0.151.0", [])

        with open(path) as f:
            data = json.load(f)
        assert data["missing"] == []
        assert data["version"] == "0.151.0"

    def test_ends_with_newline(self, tmp_path):
        path = tmp_path / "report.json"
        write_missing_display_name_report(str(path), "0.151.0", [])
        assert path.read_text(encoding="utf-8").endswith("\n")
