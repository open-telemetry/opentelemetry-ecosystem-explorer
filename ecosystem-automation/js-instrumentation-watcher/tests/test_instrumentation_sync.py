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

"""Tests for InstrumentationSync."""

import logging
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from js_instrumentation_watcher.instrumentation_sync import InstrumentationSync

REPO_PATH = Path("/repos/opentelemetry-js-contrib")


def package(name):
    return REPO_PATH / "packages" / name


@pytest.fixture
def inventory():
    manager = MagicMock()
    manager.version_exists.return_value = False
    return manager


@pytest.fixture
def collaborators():
    """Patch the scanner and parser that InstrumentationSync builds internally."""
    with (
        patch("js_instrumentation_watcher.instrumentation_sync.PackageScanner") as scanner_cls,
        patch("js_instrumentation_watcher.instrumentation_sync.PackageParser") as parser_cls,
    ):
        scanner = scanner_cls.return_value
        scanner.load_bundle_membership.return_value = set()
        scanner.load_component_owners.return_value = {}
        scanner.discover_packages.return_value = []
        yield scanner_cls, scanner, parser_cls


def test_scanner_is_built_with_the_repo_path(collaborators, inventory):
    scanner_cls, _, _ = collaborators

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory)

    scanner_cls.assert_called_once_with(REPO_PATH)


def test_sync_returns_empty_summary_when_no_packages_found(collaborators, inventory):
    sync = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory)

    assert sync.sync() == {"new": [], "skipped": [], "failed": []}


def test_sync_saves_a_package_that_is_not_yet_tracked(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-express")]
    data = {"name": "instrumentation-express", "version": "0.66.0"}
    parser_cls.return_value.parse.return_value = data

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_called_once_with("instrumentation-express", "0.66.0", data)
    assert summary["new"] == ["instrumentation-express@0.66.0"]
    assert summary["skipped"] == []
    assert summary["failed"] == []


def test_sync_checks_the_registry_with_the_package_name_and_version(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-kafkajs")]
    parser_cls.return_value.parse.return_value = {"version": "0.30.0"}

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.version_exists.assert_called_once_with("instrumentation-kafkajs", "0.30.0")


def test_sync_skips_a_package_already_in_the_registry(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-pg")]
    parser_cls.return_value.parse.return_value = {"version": "0.60.0"}
    inventory.version_exists.return_value = True

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["skipped"] == ["instrumentation-pg@0.60.0"]
    assert summary["new"] == []


def test_sync_records_a_failure_when_the_parser_raises(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-broken")]
    parser_cls.return_value.parse.side_effect = ValueError("malformed package.json")

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["instrumentation-broken"]


def test_sync_records_a_failure_when_the_parser_returns_none(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-empty")]
    parser_cls.return_value.parse.return_value = None

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["instrumentation-empty"]


def test_sync_records_a_failure_when_the_version_key_is_absent(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-noversion")]
    parser_cls.return_value.parse.return_value = {"name": "instrumentation-noversion"}

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.version_exists.assert_not_called()
    inventory.save.assert_not_called()
    assert summary["failed"] == ["instrumentation-noversion"]


def test_sync_records_a_failure_when_the_version_is_empty(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-blankversion")]
    parser_cls.return_value.parse.return_value = {"version": ""}

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["instrumentation-blankversion"]


def test_sync_keeps_going_after_one_package_raises(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("instrumentation-broken"),
        package("instrumentation-fine"),
    ]
    parser_cls.return_value.parse.side_effect = [
        RuntimeError("boom"),
        {"version": "0.40.0"},
    ]

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["failed"] == ["instrumentation-broken"]
    assert summary["new"] == ["instrumentation-fine@0.40.0"]
    inventory.save.assert_called_once_with("instrumentation-fine", "0.40.0", {"version": "0.40.0"})


def test_sync_handles_a_mix_of_new_skipped_and_failed(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("instrumentation-new"),
        package("instrumentation-existing"),
        package("instrumentation-broken"),
    ]
    parser_cls.return_value.parse.side_effect = [
        {"version": "1.0.0"},
        {"version": "2.0.0"},
        None,
    ]
    inventory.version_exists.side_effect = [False, True]

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["new"] == ["instrumentation-new@1.0.0"]
    assert summary["skipped"] == ["instrumentation-existing@2.0.0"]
    assert summary["failed"] == ["instrumentation-broken"]


def test_sync_passes_bundle_membership_and_owners_to_each_parser(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    membership = {"@opentelemetry/instrumentation-express"}
    owners = {"packages/instrumentation-express": ["seemk"]}
    scanner.load_bundle_membership.return_value = membership
    scanner.load_component_owners.return_value = owners
    scanner.discover_packages.return_value = [package("instrumentation-express")]
    parser_cls.return_value.parse.return_value = {"version": "0.66.0"}

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    parser_cls.assert_called_once_with(
        package_path=package("instrumentation-express"),
        bundle_membership=membership,
        component_owners=owners,
    )


def test_sync_loads_shared_lookups_once_not_per_package(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("instrumentation-a"),
        package("instrumentation-b"),
        package("instrumentation-c"),
    ]
    parser_cls.return_value.parse.return_value = {"version": "1.0.0"}

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert scanner.load_bundle_membership.call_count == 1
    assert scanner.load_component_owners.call_count == 1


def test_sync_logs_the_summary_counts(collaborators, inventory, caplog):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("instrumentation-new"),
        package("instrumentation-existing"),
        package("instrumentation-broken"),
    ]
    parser_cls.return_value.parse.side_effect = [
        {"version": "1.0.0"},
        {"version": "2.0.0"},
        None,
    ]
    inventory.version_exists.side_effect = [False, True]

    logger_name = "js_instrumentation_watcher.instrumentation_sync"
    with caplog.at_level(logging.INFO, logger=logger_name):
        InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert "new: 1, skipped: 1, failed: 1" in caplog.text


def test_sync_logs_the_parse_failure_with_the_package_name(collaborators, inventory, caplog):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("instrumentation-broken")]
    parser_cls.return_value.parse.side_effect = ValueError("malformed package.json")

    logger_name = "js_instrumentation_watcher.instrumentation_sync"
    with caplog.at_level(logging.ERROR, logger=logger_name):
        InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert "instrumentation-broken" in caplog.text
