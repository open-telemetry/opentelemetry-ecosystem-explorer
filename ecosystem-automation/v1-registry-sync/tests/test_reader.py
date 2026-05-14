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
"""Tests for reader module."""

import pytest
import yaml

from v1_registry_sync.reader import (
    _most_stable_level,
    read_latest_v2_components,
)


@pytest.fixture()
def fake_registry(tmp_path):
    """Build a minimal fake V2 registry with two versions."""
    for version in ["v0.9.0", "v0.10.0"]:
        version_dir = tmp_path / "contrib" / version
        version_dir.mkdir(parents=True)

    receiver_data = {
        "distribution": "contrib",
        "version": "0.10.0",
        "repository": "opentelemetry-collector-contrib",
        "component_type": "receiver",
        "components": [
            {
                "name": "fooreceiver",
                "metadata": {
                    "type": "foo",
                    "display_name": "Foo Receiver",
                    "description": "Receives foo data",
                    "status": {
                        "class": "receiver",
                        "stability": {"beta": ["metrics"]},
                    },
                },
            },
            {
                "name": "barreceiver",
                "metadata": {
                    "type": "bar",
                    "display_name": None,
                    "description": None,
                    "status": {
                        "class": "receiver",
                        "stability": {"stable": ["logs"], "beta": ["metrics"]},
                    },
                },
            },
        ],
    }

    with open(tmp_path / "contrib" / "v0.10.0" / "receiver.yaml", "w", encoding="utf-8") as f:
        yaml.dump(receiver_data, f)

    return tmp_path


class TestMostStableLevel:
    def test_returns_stable_when_present(self):
        assert _most_stable_level({"stable": ["logs"], "beta": ["metrics"]}) == "stable"

    def test_returns_beta_without_stable(self):
        assert _most_stable_level({"beta": ["metrics"], "alpha": ["traces"]}) == "beta"

    def test_returns_none_for_empty_dict(self):
        assert _most_stable_level({}) is None

    def test_returns_none_for_none_input(self):
        assert _most_stable_level(None) is None

    def test_deprecated_level(self):
        assert _most_stable_level({"deprecated": ["metrics"]}) == "deprecated"


class TestReadLatestV2Components:
    def test_reads_components_from_latest_version(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        assert report.version == "0.10.0"
        assert report.distribution == "contrib"
        assert len(report.components) == 2

    def test_extracts_display_name_and_description(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        foo = next(c for c in report.components if c.name == "fooreceiver")
        assert foo.display_name == "Foo Receiver"
        assert foo.description == "Receives foo data"

    def test_extracts_most_stable_level(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        foo = next(c for c in report.components if c.name == "fooreceiver")
        assert foo.stability == "beta"

        bar = next(c for c in report.components if c.name == "barreceiver")
        assert bar.stability == "stable"

    def test_none_display_name_is_excluded(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        bar = next(c for c in report.components if c.name == "barreceiver")
        assert bar.display_name is None

    def test_target_v1_file_follows_naming_convention(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        foo = next(c for c in report.components if c.name == "fooreceiver")
        assert foo.target_v1_file == "collector-fooreceiver.yml"

    def test_v1_entry_exists_false_when_no_v1_dir(self, fake_registry):
        report = read_latest_v2_components(str(fake_registry), distribution="contrib")

        for component in report.components:
            assert component.v1_entry_exists is False

    def test_v1_entry_exists_true_when_file_present(self, fake_registry, tmp_path):
        v1_dir = tmp_path / "v1"
        v1_dir.mkdir()
        (v1_dir / "collector-fooreceiver.yml").touch()

        report = read_latest_v2_components(
            str(fake_registry), distribution="contrib", v1_registry_dir=str(v1_dir)
        )

        foo = next(c for c in report.components if c.name == "fooreceiver")
        assert foo.v1_entry_exists is True

        bar = next(c for c in report.components if c.name == "barreceiver")
        assert bar.v1_entry_exists is False

    def test_skips_snapshot_versions(self, tmp_path):
        """list_release_versions excludes SNAPSHOT dirs so unreleased data is not picked up."""
        for version in ["v0.9.0", "v0.10.0-SNAPSHOT"]:
            version_dir = tmp_path / "contrib" / version
            version_dir.mkdir(parents=True)

        receiver_data = {
            "distribution": "contrib",
            "version": "0.10.0-SNAPSHOT",
            "component_type": "receiver",
            "components": [{"name": "snapshotreceiver", "metadata": {}}],
        }
        with open(
            tmp_path / "contrib" / "v0.10.0-SNAPSHOT" / "receiver.yaml", "w", encoding="utf-8"
        ) as f:
            yaml.dump(receiver_data, f)

        report = read_latest_v2_components(str(tmp_path), distribution="contrib")
        assert report.version == "0.9.0"
        assert all(c.name != "snapshotreceiver" for c in report.components)

    def test_raises_if_distribution_dir_missing(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            read_latest_v2_components(str(tmp_path), distribution="contrib")

    def test_raises_if_no_versions_found(self, tmp_path):
        (tmp_path / "contrib").mkdir()
        with pytest.raises(ValueError):
            read_latest_v2_components(str(tmp_path), distribution="contrib")
