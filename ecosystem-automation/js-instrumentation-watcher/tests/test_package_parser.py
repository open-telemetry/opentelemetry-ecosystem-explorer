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


def test_tav_versions_string_shorthand(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-oracledb",
            "version": "0.47.0",
            "description": "test",
        },
    )
    # Same shape as upstream oracledb, where every entry uses the string form.
    # Before the fix this whole package came out as tested_versions: [].
    tav = textwrap.dedent("""
        oracledb:
          - versions: "6.7.0"
            commands: npm run test
          - versions: ">=6.10.0 <8"
            commands: npm run test
    """)
    (tmp_package / ".tav.yml").write_text(tav)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["tested_versions"] == [
        {"package": "oracledb", "range": "6.7.0", "source": ".tav.yml"},
        {"package": "oracledb", "range": ">=6.10.0 <8", "source": ".tav.yml"},
    ]


def test_tav_versions_string_mixed_with_mappings(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-socket.io",
            "version": "0.69.0",
            "description": "test",
        },
    )
    # Same shape as upstream socket.io: the string entry sits between two
    # mapping entries, and was the only one being dropped.
    tav = textwrap.dedent("""
        socket.io:
          - versions:
              include: "^2.1.1"
              mode: latest-minors
            commands: npm run test
          - versions: "^3.1.2"
            commands: npm run test
          - versions:
              include: "^4.5.3"
              mode: latest-minors
            commands: npm run test
    """)
    (tmp_package / ".tav.yml").write_text(tav)

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert [entry["range"] for entry in result["tested_versions"]] == ["^2.1.1", "^3.1.2", "^4.5.3"]
    shorthand = result["tested_versions"][1]
    assert "mode" not in shorthand
    assert "exclude" not in shorthand


def test_tav_versions_string_on_dict_config(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # No upstream package uses this today, but the flat dict branch had the
    # same dict-only check, so it gets the same shorthand handling.
    tav = textwrap.dedent("""
        express:
          versions: ">=4.16.2 <6"
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
    assert result["tested_versions"] == [
        {"package": "express", "range": ">=4.16.2 <6", "source": ".tav.yml"},
    ]


def test_tav_versions_string_in_top_level_jobs(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-knex",
            "version": "0.58.0",
            "description": "test",
        },
    )
    # tav runs every entry of a top-level `jobs` list through the same code as
    # a normal entry, so the string shorthand is valid here too.
    tav = textwrap.dedent("""
        knex:
          jobs:
            - versions: ">=0.22.0 <1"
              commands: npm test
            - versions:
                include: ">=1 <4"
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
    assert result["tested_versions"] == [
        {"package": "knex", "range": ">=0.22.0 <1", "source": ".tav.yml"},
        {"package": "knex", "range": ">=1 <4", "mode": "latest-minors", "source": ".tav.yml"},
    ]


def test_tav_empty_versions_string_is_skipped(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # An empty string must not turn into an entry with an empty range.
    tav = textwrap.dedent("""
        express:
          - versions: ""
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
    assert result["tested_versions"] == []


def test_parse_handles_non_dict_engines(tmp_package):
    # A null/non-dict `engines` field must not raise and drop the package.
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
            "engines": None,
        },
    )

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["node_engine"] == ""


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


def test_supported_versions_empty_when_readme_has_no_section(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # A README with no "Supported Versions" heading at all, like the browser
    # packages upstream (document-load, long-task, user-interaction and others).
    (tmp_package / "README.md").write_text("# Express Instrumentation\n\nSome prose.\n")

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["supported_versions"] == []


def test_supported_versions_empty_when_readme_unreadable(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # A directory named README.md passes exists() but raises IsADirectoryError
    # (an OSError) on read. The package must still parse rather than be dropped.
    (tmp_package / "README.md").mkdir()

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["supported_versions"] == []


def test_tav_entry_includes_exclude(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-aws-sdk",
            "version": "0.77.0",
            "description": "test",
        },
    )
    tav = textwrap.dedent("""
        "@aws-sdk/client-s3":
          - versions:
              include: "^3.6.1"
              exclude: "3.529.0 || >=3.363.0 <=3.377.0"
              mode: max-7
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
    assert result["tested_versions"][0]["exclude"] == "3.529.0 || >=3.363.0 <=3.377.0"
    assert result["tested_versions"][0]["mode"] == "max-7"


def test_tav_jobs_key_inside_list_entry(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-aws-sdk",
            "version": "0.77.0",
            "description": "test",
        },
    )
    # Structure 2 nested in a list: the entry has no `versions` of its own,
    # the ranges live under `jobs`. No upstream package uses this shape today,
    # this pins the branch the parser already has for it.
    tav = textwrap.dedent("""
        "@aws-sdk/client-sqs":
          - jobs:
              - versions:
                  include: "^3.24.0"
                  mode: max-7
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
    assert result["tested_versions"][0]["package"] == "@aws-sdk/client-sqs"
    assert result["tested_versions"][0]["range"] == "^3.24.0"
    assert result["tested_versions"][0]["mode"] == "max-7"


def test_tav_top_level_jobs_key(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-aws-sdk",
            "version": "0.77.0",
            "description": "test",
        },
    )
    # Structure 2 as documented for aws-sdk: the package maps to a dict whose
    # `jobs` list carries the version ranges. Upstream uses this shape in
    # aws-sdk, knex, koa and undici.
    tav = textwrap.dedent("""
        "@aws-sdk/client-bedrock-runtime":
          jobs:
            - versions:
                include: "^3.587.0"
                exclude: ">=3.363.0 <=3.377.0"
                mode: max-7
              commands: npm test
            - versions:
                include: "^3.600.0"
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
    assert len(result["tested_versions"]) == 2
    assert result["tested_versions"][0]["exclude"] == ">=3.363.0 <=3.377.0"


def test_tav_flat_versions_on_dict_config(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # A dict config with no `jobs` - the versions hang directly off the mapping.
    tav = textwrap.dedent("""
        express:
          versions:
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
    assert result["tested_versions"][0]["range"] == ">=4.16.2 <6"


def test_tav_empty_when_yaml_is_malformed(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    (tmp_package / ".tav.yml").write_text("express:\n  - versions:\n   include: [unclosed\n")

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["tested_versions"] == []


def test_tav_empty_when_unreadable(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    # Same OSError path as the README case above.
    (tmp_package / ".tav.yml").mkdir()

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["tested_versions"] == []


def test_tav_empty_when_yaml_is_not_a_mapping(tmp_package):
    write_package_json(
        tmp_package,
        {
            "name": "@opentelemetry/instrumentation-express",
            "version": "0.66.0",
            "description": "test",
        },
    )
    (tmp_package / ".tav.yml").write_text("- express\n- mongoose\n")

    parser = PackageParser(
        package_path=tmp_package,
        bundle_membership=set(),
        component_owners={},
    )
    result = parser.parse()

    assert result is not None
    assert result["tested_versions"] == []
