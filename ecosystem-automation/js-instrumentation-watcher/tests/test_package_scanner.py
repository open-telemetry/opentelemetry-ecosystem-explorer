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

"""Tests for PackageScanner."""

import json
from pathlib import Path

import pytest
from js_instrumentation_watcher.package_scanner import PackageScanner


@pytest.fixture
def repo(tmp_path):
    """Create a minimal js-contrib-like repo structure."""
    packages_dir = tmp_path / "packages"
    packages_dir.mkdir()
    return tmp_path


def make_package(repo: Path, name: str, has_package_json: bool = True) -> Path:
    pkg_dir = repo / "packages" / name
    pkg_dir.mkdir(parents=True)
    if has_package_json:
        (pkg_dir / "package.json").write_text(json.dumps({"name": name, "version": "1.0.0"}))
    return pkg_dir


def test_discover_packages_finds_active_instrumentation_dirs(repo):
    make_package(repo, "instrumentation-express")
    make_package(repo, "instrumentation-mongoose")
    make_package(repo, "auto-instrumentations-node")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "instrumentation-express" in names
    assert "instrumentation-mongoose" in names
    assert "auto-instrumentations-node" not in names


def test_discover_packages_skips_deprecated_without_package_json(repo):
    make_package(repo, "instrumentation-redis-4", has_package_json=False)
    make_package(repo, "instrumentation-express")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "instrumentation-redis-4" not in names
    assert "instrumentation-express" in names


def test_discover_packages_returns_empty_when_packages_dir_missing(tmp_path):
    scanner = PackageScanner(tmp_path)
    assert scanner.discover_packages() == []


def test_load_bundle_membership_reads_dependencies(repo):
    auto_node_dir = repo / "packages" / "auto-instrumentations-node"
    auto_node_dir.mkdir(parents=True)
    (auto_node_dir / "package.json").write_text(
        json.dumps(
            {
                "dependencies": {
                    "@opentelemetry/instrumentation-express": "^0.66.0",
                    "@opentelemetry/instrumentation-mongoose": "^0.64.0",
                }
            }
        )
    )

    scanner = PackageScanner(repo)
    membership = scanner.load_bundle_membership()

    assert "@opentelemetry/instrumentation-express" in membership
    assert "@opentelemetry/instrumentation-mongoose" in membership


def test_load_bundle_membership_returns_empty_when_file_missing(repo):
    scanner = PackageScanner(repo)
    assert scanner.load_bundle_membership() == set()


def test_load_bundle_membership_handles_non_dict_json(repo):
    auto_node_dir = repo / "packages" / "auto-instrumentations-node"
    auto_node_dir.mkdir(parents=True)
    (auto_node_dir / "package.json").write_text(json.dumps(["not", "a", "dict"]))

    scanner = PackageScanner(repo)
    assert scanner.load_bundle_membership() == set()


def test_load_bundle_membership_handles_non_dict_dependencies(repo):
    auto_node_dir = repo / "packages" / "auto-instrumentations-node"
    auto_node_dir.mkdir(parents=True)
    (auto_node_dir / "package.json").write_text(json.dumps({"dependencies": ["bad", "shape"]}))

    scanner = PackageScanner(repo)
    assert scanner.load_bundle_membership() == set()


def test_load_bundle_membership_handles_malformed_json(repo):
    auto_node_dir = repo / "packages" / "auto-instrumentations-node"
    auto_node_dir.mkdir(parents=True)
    (auto_node_dir / "package.json").write_text("{not valid json")

    scanner = PackageScanner(repo)
    assert scanner.load_bundle_membership() == set()


def test_load_component_owners_reads_components(repo):
    github_dir = repo / ".github"
    github_dir.mkdir()
    (github_dir / "component_owners.yml").write_text(
        "components:\n"
        "  packages/instrumentation-express:\n"
        "    - owner1\n"
        "    - owner2\n"
        "  packages/instrumentation-generic-pool: []\n"
    )

    scanner = PackageScanner(repo)
    owners = scanner.load_component_owners()

    assert owners["packages/instrumentation-express"] == ["owner1", "owner2"]
    assert owners["packages/instrumentation-generic-pool"] == []


def test_load_component_owners_returns_empty_when_file_missing(repo):
    scanner = PackageScanner(repo)
    assert scanner.load_component_owners() == {}


def test_load_component_owners_handles_non_dict_top_level(repo):
    github_dir = repo / ".github"
    github_dir.mkdir()
    (github_dir / "component_owners.yml").write_text("- just\n- a\n- list\n")

    scanner = PackageScanner(repo)
    assert scanner.load_component_owners() == {}


def test_load_component_owners_handles_non_dict_components(repo):
    github_dir = repo / ".github"
    github_dir.mkdir()
    (github_dir / "component_owners.yml").write_text("components:\n  - not\n  - a\n  - dict\n")

    scanner = PackageScanner(repo)
    assert scanner.load_component_owners() == {}


def test_load_component_owners_handles_malformed_yaml(repo):
    github_dir = repo / ".github"
    github_dir.mkdir()
    (github_dir / "component_owners.yml").write_text("components:\n  bad: [unclosed\n")

    scanner = PackageScanner(repo)
    assert scanner.load_component_owners() == {}
