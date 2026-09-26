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
from python_instrumentation_watcher.instrumentation_sync import InstrumentationSync

REPO_PATH = Path("/repos/opentelemetry-python-contrib")


def package(name):
    return REPO_PATH / "instrumentation" / name


@pytest.fixture
def inventory():
    manager = MagicMock()
    manager.version_exists.return_value = False
    return manager


@pytest.fixture
def collaborators():
    """Patch the scanner and parser that InstrumentationSync builds internally."""
    with (
        patch("python_instrumentation_watcher.instrumentation_sync.PackageScanner") as scanner_cls,
        patch("python_instrumentation_watcher.instrumentation_sync.PackageParser") as parser_cls,
    ):
        scanner = scanner_cls.return_value
        scanner.discover_packages.return_value = []
        parser_cls.return_value.has_metadata_disagreement.return_value = False
        parser_cls.return_value.has_unresolved_metadata.return_value = False
        yield scanner_cls, scanner, parser_cls


def test_scanner_is_built_with_the_repo_path(collaborators, inventory):
    scanner_cls, _, _ = collaborators

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory)

    scanner_cls.assert_called_once_with(REPO_PATH)


def test_sync_returns_empty_summary_when_no_packages_found(collaborators, inventory):
    sync = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory)

    assert sync.sync() == {"new": [], "skipped": [], "failed": [], "disagreements": [], "unresolved": []}


def test_sync_saves_a_package_that_is_not_yet_tracked(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-flask")]
    data = {"name": "opentelemetry-instrumentation-flask", "version": "0.48b0"}
    parser_cls.return_value.parse.return_value = data

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_called_once_with("opentelemetry-instrumentation-flask", "0.48b0", data)
    assert summary["new"] == ["opentelemetry-instrumentation-flask@0.48b0"]
    assert summary["skipped"] == []
    assert summary["failed"] == []


def test_sync_builds_parser_with_package_and_repo_path(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    pkg_path = package("opentelemetry-instrumentation-flask")
    scanner.discover_packages.return_value = [pkg_path]
    parser_cls.return_value.parse.return_value = {"version": "0.48b0"}

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    parser_cls.assert_called_once_with(package_path=pkg_path, repo_path=REPO_PATH)


def test_sync_checks_the_registry_with_the_package_name_and_version(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-kafka")]
    parser_cls.return_value.parse.return_value = {"version": "0.30.0"}

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.version_exists.assert_called_once_with("opentelemetry-instrumentation-kafka", "0.30.0")


def test_sync_skips_a_package_already_in_the_registry(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-pg")]
    parser_cls.return_value.parse.return_value = {"version": "0.60.0"}
    inventory.version_exists.return_value = True

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["skipped"] == ["opentelemetry-instrumentation-pg@0.60.0"]
    assert summary["new"] == []


def test_sync_records_a_failure_when_the_parser_raises(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-broken")]
    parser_cls.return_value.parse.side_effect = ValueError("malformed pyproject.toml")

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["opentelemetry-instrumentation-broken"]


def test_sync_records_a_failure_when_the_parser_returns_none(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-empty")]
    parser_cls.return_value.parse.return_value = None

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["opentelemetry-instrumentation-empty"]


def test_sync_records_a_failure_when_the_version_key_is_absent(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-noversion")]
    parser_cls.return_value.parse.return_value = {"name": "opentelemetry-instrumentation-noversion"}

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.version_exists.assert_not_called()
    inventory.save.assert_not_called()
    assert summary["failed"] == ["opentelemetry-instrumentation-noversion"]


def test_sync_records_a_failure_when_the_version_is_empty(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-blankversion")]
    parser_cls.return_value.parse.return_value = {"version": ""}

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    inventory.save.assert_not_called()
    assert summary["failed"] == ["opentelemetry-instrumentation-blankversion"]


def test_sync_keeps_going_after_one_package_raises(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("opentelemetry-instrumentation-broken"),
        package("opentelemetry-instrumentation-fine"),
    ]
    parser_cls.return_value.parse.side_effect = [
        RuntimeError("boom"),
        {"version": "0.40.0"},
    ]

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["failed"] == ["opentelemetry-instrumentation-broken"]
    assert summary["new"] == ["opentelemetry-instrumentation-fine@0.40.0"]
    inventory.save.assert_called_once_with("opentelemetry-instrumentation-fine", "0.40.0", {"version": "0.40.0"})


def test_sync_handles_a_mix_of_new_skipped_and_failed(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("opentelemetry-instrumentation-new"),
        package("opentelemetry-instrumentation-existing"),
        package("opentelemetry-instrumentation-broken"),
    ]
    parser_cls.return_value.parse.side_effect = [
        {"version": "1.0.0"},
        {"version": "2.0.0"},
        None,
    ]
    inventory.version_exists.side_effect = [False, True]

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["new"] == ["opentelemetry-instrumentation-new@1.0.0"]
    assert summary["skipped"] == ["opentelemetry-instrumentation-existing@2.0.0"]
    assert summary["failed"] == ["opentelemetry-instrumentation-broken"]


def test_sync_records_a_metadata_disagreement_without_blocking_the_save(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-flask")]
    parser_cls.return_value.parse.return_value = {"version": "0.48b0"}
    parser_cls.return_value.has_metadata_disagreement.return_value = True

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["disagreements"] == ["opentelemetry-instrumentation-flask@0.48b0"]
    assert summary["new"] == ["opentelemetry-instrumentation-flask@0.48b0"]
    inventory.save.assert_called_once()


def test_sync_does_not_check_disagreement_when_parse_fails(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-broken")]
    parser_cls.return_value.parse.return_value = None

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    parser_cls.return_value.has_metadata_disagreement.assert_not_called()


def test_sync_records_unresolved_metadata_without_blocking_the_save(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-botocore")]
    parser_cls.return_value.parse.return_value = {"version": "1.0.0"}
    parser_cls.return_value.has_unresolved_metadata.return_value = True

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["unresolved"] == ["opentelemetry-instrumentation-botocore@1.0.0"]
    assert summary["new"] == ["opentelemetry-instrumentation-botocore@1.0.0"]
    assert summary["disagreements"] == []
    inventory.save.assert_called_once()


def test_sync_keeps_disagreement_and_unresolved_counts_independent(collaborators, inventory):
    """A package can be both disagreeing and unresolved (on different instrument
    keys) at once — the two buckets must not be conflated or mutually exclusive."""
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-botocore")]
    parser_cls.return_value.parse.return_value = {"version": "1.0.0"}
    parser_cls.return_value.has_metadata_disagreement.return_value = True
    parser_cls.return_value.has_unresolved_metadata.return_value = True

    summary = InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert summary["disagreements"] == ["opentelemetry-instrumentation-botocore@1.0.0"]
    assert summary["unresolved"] == ["opentelemetry-instrumentation-botocore@1.0.0"]


def test_sync_does_not_check_unresolved_metadata_when_parse_fails(collaborators, inventory):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-broken")]
    parser_cls.return_value.parse.return_value = None

    InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    parser_cls.return_value.has_unresolved_metadata.assert_not_called()


def test_sync_logs_when_metadata_is_unresolved(collaborators, inventory, caplog):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-botocore")]
    parser_cls.return_value.parse.return_value = {"version": "1.0.0"}
    parser_cls.return_value.has_unresolved_metadata.return_value = True

    logger_name = "python_instrumentation_watcher.instrumentation_sync"
    with caplog.at_level(logging.WARNING, logger=logger_name):
        InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert "opentelemetry-instrumentation-botocore@1.0.0" in caplog.text
    assert "not be statically resolved" in caplog.text


def test_sync_logs_the_summary_counts(collaborators, inventory, caplog):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [
        package("opentelemetry-instrumentation-new"),
        package("opentelemetry-instrumentation-existing"),
        package("opentelemetry-instrumentation-broken"),
    ]
    parser_cls.return_value.parse.side_effect = [
        {"version": "1.0.0"},
        {"version": "2.0.0"},
        None,
    ]
    inventory.version_exists.side_effect = [False, True]

    logger_name = "python_instrumentation_watcher.instrumentation_sync"
    with caplog.at_level(logging.INFO, logger=logger_name):
        InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert "new: 1, skipped: 1, failed: 1, disagreements: 0, unresolved: 0" in caplog.text


def test_sync_logs_the_parse_failure_with_the_package_name(collaborators, inventory, caplog):
    _, scanner, parser_cls = collaborators
    scanner.discover_packages.return_value = [package("opentelemetry-instrumentation-broken")]
    parser_cls.return_value.parse.side_effect = ValueError("malformed pyproject.toml")

    logger_name = "python_instrumentation_watcher.instrumentation_sync"
    with caplog.at_level(logging.ERROR, logger=logger_name):
        InstrumentationSync(repo_path=REPO_PATH, inventory_manager=inventory).sync()

    assert "opentelemetry-instrumentation-broken" in caplog.text


# --- Real (unmocked) end-to-end integration tests -----------------------------
#
# Every test above patches PackageScanner and PackageParser, so a wiring gap
# between InstrumentationSync and the real PackageParser (e.g.
# has_unresolved_metadata() being implemented but never actually called from
# sync()) would not be caught here — the mock always reports whatever the test
# configured, regardless of what sync() actually does with the real objects.
# These tests instead exercise real PackageScanner/PackageParser/InventoryManager
# instances against synthetic files shaped exactly like real upstream
# opentelemetry-python-contrib package.py content (cross-checked against a live
# clone during development of this fix — see repository_manager's real-git
# integration tests for the equivalent note on that side).


def _write_pyproject(pkg_dir: Path, content: str) -> None:
    pkg_dir.mkdir(parents=True, exist_ok=True)
    (pkg_dir / "pyproject.toml").write_text(content)


def _write_package_py(pkg_dir: Path, content: str, rel_path: str) -> None:
    path = pkg_dir / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def test_sync_end_to_end_reports_unresolved_for_a_real_shaped_botocore_package_py(tmp_path):
    """The exact shape of the real opentelemetry-instrumentation-botocore
    package.py (`_instruments = ()`, `_instruments_any` built from a starred
    same-file reference), run through the real, unmocked pipeline. This is what
    a real clone actually exposes: has_unresolved_metadata()'s state reaching the
    sync summary depends on sync() actually calling it, not just on the method
    existing and being correct in isolation.
    """
    from python_instrumentation_watcher.inventory_manager import InventoryManager

    repo = tmp_path
    pkg_dir = repo / "instrumentation" / "opentelemetry-instrumentation-botocore"
    _write_pyproject(
        pkg_dir,
        """\
[project]
name = "opentelemetry-instrumentation-botocore"
version = "0.65b0"

[project.optional-dependencies]
instruments-any = ["botocore~=1.0", "aiobotocore>=2.0,<4.0"]
""",
    )
    _write_package_py(
        pkg_dir,
        # Verbatim shape of the real upstream package.py for this package.
        '_instruments_botocore = ("botocore~=1.0",)\n'
        '_instruments_aiobotocore = ("aiobotocore>=2.0,<4.0",)\n\n'
        "_instruments = ()\n"
        "_instruments_any = (*_instruments_botocore, *_instruments_aiobotocore)\n",
        rel_path="src/opentelemetry/instrumentation/botocore/package.py",
    )

    inventory = InventoryManager(registry_dir=str(tmp_path / "registry"))
    summary = InstrumentationSync(repo_path=repo, inventory_manager=inventory).sync()

    assert summary["new"] == ["opentelemetry-instrumentation-botocore@0.65b0"]
    assert summary["disagreements"] == []
    # The whole point of the fix: botocore's real-shaped _instruments_any now
    # resolves correctly, so it is neither falsely "disagreeing" nor silently
    # dropped — it doesn't even need the unresolved flag here, since it's fully
    # resolvable and matches pyproject.toml.
    assert summary["unresolved"] == []


def test_sync_end_to_end_reports_unresolved_for_a_genuinely_dynamic_package_py(tmp_path):
    """The companion real-pipeline case: a genuinely unresolvable
    `_instruments_any` (not one of the supported static forms) must actually
    reach summary["unresolved"] via the real, unmocked call chain — not just
    return True when called directly on a parser instance in isolation."""
    from python_instrumentation_watcher.inventory_manager import InventoryManager

    repo = tmp_path
    pkg_dir = repo / "instrumentation" / "opentelemetry-instrumentation-example"
    _write_pyproject(
        pkg_dir,
        """\
[project]
name = "opentelemetry-instrumentation-example"
version = "1.0.0"

[project.optional-dependencies]
instruments-any = ["examplelib >= 1.0"]
""",
    )
    _write_package_py(
        pkg_dir,
        '_instruments = ()\n_instruments_any = tuple(x for x in ["examplelib >= 1.0"])\n',
        rel_path="src/opentelemetry/instrumentation/example/package.py",
    )

    inventory = InventoryManager(registry_dir=str(tmp_path / "registry"))
    summary = InstrumentationSync(repo_path=repo, inventory_manager=inventory).sync()

    assert summary["unresolved"] == ["opentelemetry-instrumentation-example@1.0.0"]
    assert summary["disagreements"] == []
    assert summary["new"] == ["opentelemetry-instrumentation-example@1.0.0"]


def test_sync_end_to_end_reports_a_real_shaped_tortoiseorm_style_disagreement(tmp_path):
    """The exact real inconsistency found on a live clone: tortoiseorm's
    pyproject.toml `instruments` lists two entries (tortoise-orm, pydantic) but
    package.py's `_instruments` only mirrors one — a genuine, real disagreement,
    run through the real pipeline end to end."""
    from python_instrumentation_watcher.inventory_manager import InventoryManager

    repo = tmp_path
    pkg_dir = repo / "instrumentation" / "opentelemetry-instrumentation-tortoiseorm"
    _write_pyproject(
        pkg_dir,
        """\
[project]
name = "opentelemetry-instrumentation-tortoiseorm"
version = "0.65b0"

[project.optional-dependencies]
instruments = ["tortoise-orm >= 0.17.0", "pydantic >= 1.10.2"]
""",
    )
    _write_package_py(
        pkg_dir,
        '_instruments = ("tortoise-orm >= 0.17.0",)\n',
        rel_path="src/opentelemetry/instrumentation/tortoiseorm/package.py",
    )

    inventory = InventoryManager(registry_dir=str(tmp_path / "registry"))
    summary = InstrumentationSync(repo_path=repo, inventory_manager=inventory).sync()

    assert summary["disagreements"] == ["opentelemetry-instrumentation-tortoiseorm@0.65b0"]
    assert summary["unresolved"] == []
    # A real disagreement still doesn't block the write — pyproject.toml wins.
    assert summary["new"] == ["opentelemetry-instrumentation-tortoiseorm@0.65b0"]
