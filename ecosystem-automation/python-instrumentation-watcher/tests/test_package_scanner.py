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

from pathlib import Path

import pytest
from python_instrumentation_watcher.package_scanner import PackageScanner


@pytest.fixture
def repo(tmp_path):
    """Create a minimal python-contrib-like repo structure."""
    (tmp_path / "instrumentation").mkdir()
    return tmp_path


def make_package(repo: Path, name: str, under: str = "instrumentation", has_pyproject: bool = True) -> Path:
    pkg_dir = repo / under / name
    pkg_dir.mkdir(parents=True)
    if has_pyproject:
        (pkg_dir / "pyproject.toml").write_text('[project]\nname = "%s"\n' % name)
    return pkg_dir


def test_discover_packages_finds_instrumentation_dirs(repo):
    make_package(repo, "opentelemetry-instrumentation-flask")
    make_package(repo, "opentelemetry-instrumentation-requests")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "opentelemetry-instrumentation-flask" in names
    assert "opentelemetry-instrumentation-requests" in names


def test_discover_packages_skips_non_prefixed_dirs(repo):
    make_package(repo, "opentelemetry-instrumentation-flask")
    make_package(repo, "some-other-tool")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "some-other-tool" not in names
    assert "opentelemetry-instrumentation-flask" in names


def test_discover_packages_skips_dirs_without_pyproject_toml(repo):
    make_package(repo, "opentelemetry-instrumentation-broken", has_pyproject=False)
    make_package(repo, "opentelemetry-instrumentation-flask")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "opentelemetry-instrumentation-broken" not in names
    assert "opentelemetry-instrumentation-flask" in names


def test_discover_packages_ignores_instrumentation_genai(repo):
    (repo / "instrumentation-genai").mkdir()
    make_package(repo, "opentelemetry-instrumentation-genai-openai", under="instrumentation-genai")
    make_package(repo, "opentelemetry-instrumentation-flask")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    names = [p.name for p in found]
    assert "opentelemetry-instrumentation-genai-openai" not in names
    assert "opentelemetry-instrumentation-flask" in names


def test_discover_packages_returns_empty_when_instrumentation_dir_missing(tmp_path):
    scanner = PackageScanner(tmp_path)
    assert scanner.discover_packages() == []


def test_discover_packages_ignores_non_directories(repo):
    (repo / "instrumentation" / "README.md").write_text("not a package")
    make_package(repo, "opentelemetry-instrumentation-flask")

    scanner = PackageScanner(repo)
    found = scanner.discover_packages()

    assert [p.name for p in found] == ["opentelemetry-instrumentation-flask"]
