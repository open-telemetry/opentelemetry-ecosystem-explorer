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
"""Tests for reporter module."""

import io
import json

import pytest
import yaml

from v1_registry_sync.models import ComponentSyncData, V1SyncReport
from v1_registry_sync.reporter import write_report


@pytest.fixture()
def sample_report():
    return V1SyncReport(
        version="0.10.0",
        distribution="contrib",
        components=[
            ComponentSyncData(
                name="fooreceiver",
                component_type="receiver",
                distribution="contrib",
                display_name="Foo Receiver",
                description="Receives foo data",
                stability="beta",
                target_v1_file="collector-fooreceiver.yml",
                v1_entry_exists=True,
            ),
            ComponentSyncData(
                name="barexporter",
                component_type="exporter",
                distribution="contrib",
                display_name=None,
                description=None,
                stability="stable",
                target_v1_file="collector-barexporter.yml",
                v1_entry_exists=False,
            ),
        ],
    )


class TestWriteReportJson:
    def test_outputs_valid_json(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="json")
        data = json.loads(out.getvalue())
        assert data["version"] == "0.10.0"
        assert data["distribution"] == "contrib"

    def test_includes_target_v1_file_and_exists_flag(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="json")
        data = json.loads(out.getvalue())

        foo = next(c for c in data["components"] if c["name"] == "fooreceiver")
        assert foo["target_v1_file"] == "collector-fooreceiver.yml"
        assert foo["v1_entry_exists"] is True

        bar = next(c for c in data["components"] if c["name"] == "barexporter")
        assert bar["target_v1_file"] == "collector-barexporter.yml"
        assert bar["v1_entry_exists"] is False

    def test_includes_description_in_proposed_changes(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="json")
        data = json.loads(out.getvalue())

        foo = next(c for c in data["components"] if c["name"] == "fooreceiver")
        assert foo["proposed_v1_changes"]["description"] == "Receives foo data"
        assert "title" not in foo["proposed_v1_changes"]
        assert "stability" not in foo["proposed_v1_changes"]

    def test_omits_null_description_from_proposed_changes(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="json")
        data = json.loads(out.getvalue())

        bar = next(c for c in data["components"] if c["name"] == "barexporter")
        assert "description" not in bar["proposed_v1_changes"]
        assert "stability" not in bar["proposed_v1_changes"]

    def test_all_components_present(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="json")
        data = json.loads(out.getvalue())
        assert len(data["components"]) == 2


class TestWriteReportYaml:
    def test_outputs_valid_yaml(self, sample_report):
        out = io.StringIO()
        write_report(sample_report, out, fmt="yaml")
        data = yaml.safe_load(out.getvalue())
        assert data["version"] == "0.10.0"
        assert len(data["components"]) == 2
