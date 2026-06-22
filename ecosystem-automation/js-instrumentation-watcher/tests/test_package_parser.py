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

"""Tests for PackageParser."""

import json
import textwrap
from pathlib import Path

import pytest
from js_instrumentation_watcher.package_parser import PackageParser


@pytest.fixture
def tmp_package(tmp_path):
    """Create a minimal instrumentation package directory."""
    pkg_dir = tmp_path / "instrumentation-express"
    pkg_dir.mkdir()
    return pkg_dir


def write_package_json(pkg_dir: Path, data: dict) -> None:
    (pkg_dir / "package.json").write_text(json.dumps(data))


def test_parse_basic_fields(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "Express instrumentation",
            "engines": {"node": "^18.19.0 || >=20.6.0"},
            "repository": {
                "type": "git",
                "url": "https://github.com/open-telemetry/opentelemetry-js-contrib.git",
                "directory": "packages/instrumentation-express",
            },
        },
    )

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership={"@opentelemetry/instrumentation-express"},
        component_owners={"packages/instrumentation-express": ["owner1"]},
    )
    result = parser.parse()

    assert result is not None
    assert result["name"] == "instrumentation-express"
    assert result["npm_package"] == "@opentelemetry/instrumentation-express"
    assert result["version"] == "0.66.0"
    assert result["node_engine"] == "^18.19.0 || >=20.6.0"
    assert result["in_auto_instrumentations_node"] is True
    assert result["component_owners"] == ["owner1"]
    assert result["source_path"] == "packages/instrumentation-express"


def test_parse_returns_none_on_missing_package_json(tmp_package):
    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    assert parser.parse() is None


def test_parse_supported_versions_from_readme(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    readme = textwrap.dedent("""
        ## Installation

        ### Supported Versions

        - [`express`](https://www.npmjs.com/package/express) version `>=4.0.0 <6`

        ## Usage
    """)
    (tmp_package / "README.md").write_text(readme)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert len(result["supported_versions"]) == 1
    assert result["supported_versions"][0]["package"] == "express"
    assert result["supported_versions"][0]["version_range"] == ">=4.0.0 <6"
    assert result["supported_versions"][0]["source"] == "README.md"


def test_parse_tav_yml(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    tav = textwrap.dedent("""
        express:
          - versions:
              include: ">=4.16.2 <6"
              mode: latest-minors
            commands: npm test
    """)
    (tmp_package / ".tav.yml").write_text(tav)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert len(result["tested_versions"]) == 1
    assert result["tested_versions"][0]["package"] == "express"
    assert result["tested_versions"][0]["range"] == ">=4.16.2 <6"
    assert result["tested_versions"][0]["mode"] == "latest-minors"
    assert result["tested_versions"][0]["source"] == ".tav.yml"
    assert "exclude" not in result["tested_versions"][0]


def test_tav_entry_omits_mode_when_empty(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    tav = textwrap.dedent("""
        express:
          - versions:
              include: ">=4.0.0 <6"
            commands: npm test
    """)
    (tmp_package / ".tav.yml").write_text(tav)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert "mode" not in result["tested_versions"][0]


def test_tested_versions_sorted_deterministically(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-mongoose",
            "version": "0.64.0",
            "description": "test",
        },
    )
    # Intentionally out of order to verify sorting
    tav = textwrap.dedent("""
        mongoose:
          - versions:
              include: ">=9 <10"
              mode: max-7
            commands: npm test
          - versions:
              include: ">=5.9.7 <7"
              mode: latest-majors
            commands: npm test
    """)
    (tmp_package / ".tav.yml").write_text(tav)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    ranges = [entry["range"] for entry in result["tested_versions"]]
    assert ranges == sorted(ranges)


def test_not_in_bundle_when_absent(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["in_auto_instrumentations_node"] is False
