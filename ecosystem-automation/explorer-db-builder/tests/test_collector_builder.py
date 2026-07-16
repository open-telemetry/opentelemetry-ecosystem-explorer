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
"""Tests for collector_builder module."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from explorer_db_builder.collector_builder import (
    MINIMUM_VERSION,
    _get_merged_release_versions,
    run_collector_builder,
)
from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from semantic_version import Version


def _make_mock_inventory_manager(versions_by_distribution=None, inventories=None):
    manager = MagicMock()

    if versions_by_distribution is None:
        versions_by_distribution = {
            "core": [Version("0.151.0"), Version("0.150.0")],
            "contrib": [Version("0.151.0"), Version("0.150.0")],
        }

    manager.list_release_versions.side_effect = lambda dist: versions_by_distribution.get(dist, [])

    if inventories is None:
        inventories = {
            ("core", Version("0.151.0")): _make_core_inventory("0.151.0"),
            ("core", Version("0.150.0")): _make_core_inventory("0.150.0"),
            ("contrib", Version("0.151.0")): _make_contrib_inventory("0.151.0"),
            ("contrib", Version("0.150.0")): _make_contrib_inventory("0.150.0"),
        }

    manager.load_versioned_inventory.side_effect = lambda dist, ver: inventories.get(
        (dist, ver), {"distribution": dist, "version": str(ver), "repository": "", "components": {}}
    )

    # Default to "no readmes" so existing tests that don't care about readme
    # handling aren't affected. Tests that do care override this explicitly.
    manager.load_component_readme_map.return_value = {}

    return manager


def _make_core_inventory(version: str) -> dict:
    return {
        "distribution": "core",
        "version": version,
        "repository": "opentelemetry-collector",
        "components": {
            "receiver": [
                {
                    "name": "nopreceiver",
                    "metadata": {
                        "type": "nop",
                        "display_name": "No-op Receiver",
                        "status": {"stability": {"beta": ["traces"]}},
                    },
                }
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }


def _make_contrib_inventory(version: str) -> dict:
    return {
        "distribution": "contrib",
        "version": version,
        "repository": "opentelemetry-collector-contrib",
        "components": {
            "receiver": [
                {
                    "name": "otlpreceiver",
                    "metadata": {
                        "type": "otlp",
                        "display_name": "OTLP Receiver",
                        "status": {"stability": {"beta": ["traces"]}},
                    },
                },
                {
                    "name": "prometheusreceiver",
                    "metadata": {
                        "type": "prometheus",
                        "display_name": "Prometheus Receiver",
                        "status": {"stability": {"beta": ["metrics"]}},
                    },
                },
            ],
            "processor": [],
            "exporter": [],
            "connector": [],
            "extension": [],
        },
    }


class TestGetMergedReleaseVersions:
    def test_returns_union_sorted_newest_first(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.152.0"), Version("0.150.0")],
                "contrib": [Version("0.152.0"), Version("0.151.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [Version("0.152.0"), Version("0.151.0"), Version("0.150.0")]

    def test_raises_when_no_versions(self):
        manager = MagicMock()
        manager.list_release_versions.return_value = []
        with pytest.raises(ValueError, match="No release versions"):
            _get_merged_release_versions(manager)

    def test_deduplicates_shared_versions(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.150.0")],
                "contrib": [Version("0.150.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [Version("0.150.0")]

    def test_excludes_versions_below_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.151.0"), Version("0.150.0"), Version("0.100.0")],
                "contrib": [Version("0.151.0"), Version("0.99.0")],
            }
        )
        result = _get_merged_release_versions(manager)
        assert all(v >= MINIMUM_VERSION for v in result)
        assert Version("0.100.0") not in result
        assert Version("0.99.0") not in result

    def test_raises_when_all_versions_below_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [Version("0.99.0"), Version("0.50.0")],
                "contrib": [Version("0.99.0")],
            }
        )
        with pytest.raises(ValueError, match=str(MINIMUM_VERSION)):
            _get_merged_release_versions(manager)

    def test_includes_version_equal_to_minimum(self):
        manager = _make_mock_inventory_manager(
            versions_by_distribution={
                "core": [MINIMUM_VERSION],
                "contrib": [MINIMUM_VERSION],
            }
        )
        result = _get_merged_release_versions(manager)
        assert result == [MINIMUM_VERSION]


class TestRunCollectorBuilder:
    def test_success_creates_output_files(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        assert (tmp_path / "collector" / "versions-index.json").exists()
        assert (tmp_path / "collector" / "index.json").exists()
        assert (tmp_path / "collector" / "versions").exists()

    def test_versions_index_content(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "versions-index.json") as f:
            data = json.load(f)

        assert len(data["versions"]) == 2
        assert data["versions"][0]["version"] == "0.151.0"
        assert data["versions"][0]["is_latest"] is True

    def test_component_files_created(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        components_dir = tmp_path / "collector" / "components"
        assert components_dir.exists()
        component_dirs = list(components_dir.iterdir())
        # core: 1 receiver + contrib: 2 receivers = 3 total
        assert len(component_dirs) == 3

    def test_index_json_content(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "index.json") as f:
            data = json.load(f)

        assert data["ecosystem"] == "collector"
        assert sorted(data["taxonomy"]["distributions"]) == ["contrib", "core"]
        assert "receiver" in data["taxonomy"]["types"]
        assert len(data["components"]) == 3

    def test_creates_per_version_bundles_referenced_by_index(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "versions-index.json") as f:
            data = json.load(f)

        latest = data["versions"][0]
        assert latest["bundle_hash"]
        bundle_file = tmp_path / "collector" / "bundles" / f"{latest['version']}-{latest['bundle_hash']}.json"
        assert bundle_file.exists()
        with open(bundle_file) as f:
            bundle = json.load(f)
        # Slim entries: index shape with derived stability, no nested status/attributes.
        assert len(bundle) == 3
        assert all(
            set(entry.keys())
            <= {
                "id",
                "name",
                "distribution",
                "type",
                "display_name",
                "description",
                "stability",
                "signals",
                "has_readme",
            }
            for entry in bundle
        )

    def test_clean_flag(self, tmp_path):
        manager = _make_mock_inventory_manager()
        out_dir = tmp_path / "collector"
        db_writer = CollectorDatabaseWriter(database_dir=str(out_dir))

        # First build
        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        # Create a stale file that should be removed on clean
        stale = out_dir / "stale.json"
        stale.write_text("{}")

        # Clean build using a fresh writer (simulating --clean)
        db_writer2 = CollectorDatabaseWriter(database_dir=str(out_dir))
        run_collector_builder(inventory_manager=manager, db_writer=db_writer2, clean=True)

        assert not stale.exists()

    def test_returns_1_on_no_versions(self, tmp_path):
        manager = MagicMock()
        manager.list_release_versions.return_value = []
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 1

    def test_versions_index_excludes_empty_versions(self, tmp_path):
        # 0.151.0 has components; 0.150.0 returns an empty inventory
        inventories = {
            ("core", Version("0.151.0")): _make_core_inventory("0.151.0"),
            ("contrib", Version("0.151.0")): _make_contrib_inventory("0.151.0"),
            ("core", Version("0.150.0")): {
                "distribution": "core",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.150.0")): {
                "distribution": "contrib",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        with open(tmp_path / "collector" / "versions-index.json") as f:
            data = json.load(f)

        versions_listed = [v["version"] for v in data["versions"]]
        assert versions_listed == ["0.151.0"]
        assert not (tmp_path / "collector" / "versions" / "0.150.0-index.json").exists()

    def test_writes_ecosystem_stats(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        with open(tmp_path / "collector" / "ecosystem-stats.json") as f:
            data = json.load(f)

        assert data["version_count"] == 2
        # Both mocked versions carry the same 3 components (core: 1 receiver, contrib: 2
        # receivers), so the union across versions is still 3, not 6.
        assert data["component_count"] == 3

    def test_ecosystem_stats_counts_components_removed_in_newer_versions(self, tmp_path):
        """A component present only in an older version still contributes to the total."""
        inventories = {
            ("core", Version("0.151.0")): _make_core_inventory("0.151.0"),
            ("contrib", Version("0.151.0")): {
                "distribution": "contrib",
                "version": "0.151.0",
                "repository": "opentelemetry-collector-contrib",
                "components": {
                    "receiver": [],
                    "processor": [],
                    "exporter": [],
                    "connector": [],
                    "extension": [],
                },
            },
            ("core", Version("0.150.0")): _make_core_inventory("0.150.0"),
            ("contrib", Version("0.150.0")): _make_contrib_inventory("0.150.0"),
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 0
        with open(tmp_path / "collector" / "ecosystem-stats.json") as f:
            data = json.load(f)

        # 0.151.0 has only core's 1 receiver; 0.150.0 additionally has contrib's 2 receivers.
        assert data["component_count"] == 3

    def test_returns_1_when_all_versions_empty(self, tmp_path):
        inventories = {
            ("core", Version("0.151.0")): {
                "distribution": "core",
                "version": "0.151.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.151.0")): {
                "distribution": "contrib",
                "version": "0.151.0",
                "repository": "",
                "components": {},
            },
            ("core", Version("0.150.0")): {
                "distribution": "core",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
            ("contrib", Version("0.150.0")): {
                "distribution": "contrib",
                "version": "0.150.0",
                "repository": "",
                "components": {},
            },
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        result = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert result == 1


class TestRunCollectorBuilderAuditReport:
    def test_no_report_written_without_path(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        # No stray report file anywhere when the flag isn't passed.
        assert list(tmp_path.glob("*.json")) == []

    def test_report_lists_only_latest_release_missing_components(self, tmp_path):
        # Latest (0.151.0): one component without display_name; an older version has none
        # missing, and must not leak into the latest-only report.
        core_latest = {
            "distribution": "core",
            "version": "0.151.0",
            "repository": "opentelemetry-collector",
            "components": {
                "receiver": [
                    {"name": "nopreceiver", "metadata": {"display_name": "No-op Receiver"}},
                    {"name": "mysteryreceiver", "metadata": {}},  # missing display_name
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        }
        contrib_latest = {
            "distribution": "contrib",
            "version": "0.151.0",
            "repository": "opentelemetry-collector-contrib",
            "components": {t: [] for t in ["receiver", "processor", "exporter", "connector", "extension"]},
        }
        inventories = {
            ("core", Version("0.151.0")): core_latest,
            ("contrib", Version("0.151.0")): contrib_latest,
            ("core", Version("0.150.0")): _make_core_inventory("0.150.0"),
            ("contrib", Version("0.150.0")): _make_contrib_inventory("0.150.0"),
        }
        manager = _make_mock_inventory_manager(inventories=inventories)
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        report_path = tmp_path / "missing.json"

        result = run_collector_builder(
            inventory_manager=manager, db_writer=db_writer, audit_report_path=str(report_path)
        )

        assert result == 0
        with open(report_path) as f:
            report = json.load(f)

        assert report["ecosystem"] == "collector"
        assert report["version"] == "0.151.0"
        assert [c["name"] for c in report["missing"]] == ["mysteryreceiver"]

    def test_report_empty_when_all_have_display_name(self, tmp_path):
        manager = _make_mock_inventory_manager()  # default fixtures all carry display_name
        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        report_path = tmp_path / "missing.json"

        run_collector_builder(inventory_manager=manager, db_writer=db_writer, audit_report_path=str(report_path))

        with open(report_path) as f:
            report = json.load(f)
        assert report["missing"] == []

    def test_report_path_inside_database_dir_fails(self, tmp_path):
        manager = _make_mock_inventory_manager()
        db_dir = tmp_path / "collector"
        db_writer = CollectorDatabaseWriter(database_dir=str(db_dir))
        # A report written inside the DB dir would get committed / bump DB_VERSION.
        report_path = db_dir / "audit" / "missing.json"

        result = run_collector_builder(
            inventory_manager=manager, db_writer=db_writer, audit_report_path=str(report_path)
        )

        assert result == 1
        assert not report_path.exists()


class TestRunCollectorBuilderReadmes:
    """Mirrors test_main.py's test_run_builder_processes_readmes for the javaagent builder."""

    def test_processes_readmes_and_stamps_markdown_hash(self, tmp_path):
        version = Version("0.150.0")
        core_inventory = {
            "distribution": "core",
            "version": "0.150.0",
            "repository": "opentelemetry-collector",
            "components": {
                "receiver": [{"name": "otlpreceiver", "metadata": {"display_name": "OTLP Receiver"}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        }
        contrib_inventory = {
            "distribution": "contrib",
            "version": "0.150.0",
            "repository": "opentelemetry-collector-contrib",
            "components": {t: [] for t in ["receiver", "processor", "exporter", "connector", "extension"]},
        }

        manager = _make_mock_inventory_manager(
            versions_by_distribution={"core": [version], "contrib": [version]},
            inventories={("core", version): core_inventory, ("contrib", version): contrib_inventory},
        )
        readme_map = {"otlpreceiver": "abc123def456"}
        readme_content = "# OTLP Receiver README"
        manager.load_component_readme_map.side_effect = lambda dist, ver: readme_map if dist == "core" else {}
        manager.load_component_readme_content.return_value = readme_content

        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        exit_code = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert exit_code == 0

        # README content was loaded and published.
        manager.load_component_readme_content.assert_any_call("core", version, "otlpreceiver", "abc123def456")
        markdown_file = tmp_path / "collector" / "markdown" / "otlpreceiver-abc123def456.md"
        assert markdown_file.exists()
        assert markdown_file.read_text(encoding="utf-8") == readme_content

        # Hash was stamped onto the matching component's written record.
        with open(tmp_path / "collector" / "index.json") as f:
            index_data = json.load(f)
        otlp_entry = next(c for c in index_data["components"] if c["name"] == "otlpreceiver")
        assert otlp_entry["has_readme"] is True

    def test_readme_load_failure_does_not_fail_the_build(self, tmp_path):
        """A README-loading failure for one distribution must not block the whole build."""
        version = Version("0.150.0")
        manager = _make_mock_inventory_manager(versions_by_distribution={"core": [version], "contrib": [version]})
        manager.load_component_readme_map.side_effect = OSError("simulated disk error")

        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        exit_code = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert exit_code == 0
        assert (tmp_path / "collector" / "index.json").exists()


class TestReadmePublishingIsolation:
    """Regression tests for a Copilot-flagged review issue: one component's
    README failure used to abort the rest of the distribution, and a failed
    README load still left markdown_hash stamped on the component record."""

    def test_one_component_readme_failure_does_not_block_the_rest(self, tmp_path):
        """Exercises the defensive per-component OSError isolation via a mocked
        raise - the real InventoryManager.load_component_readme_content
        swallows OSError and returns None rather than raising (see
        test_failed_readme_load_does_not_stamp_markdown_hash below for that
        real, non-raising path). This test guards the isolation itself
        staying correct if that ever changes, not current production behavior."""
        version = Version("0.150.0")
        core_inventory = {
            "distribution": "core",
            "version": "0.150.0",
            "repository": "opentelemetry-collector",
            "components": {
                "receiver": [
                    {"name": "badreceiver", "metadata": {"display_name": "Bad"}},
                    {"name": "goodreceiver", "metadata": {"display_name": "Good"}},
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        }
        contrib_inventory = {
            "distribution": "contrib",
            "version": "0.150.0",
            "repository": "opentelemetry-collector-contrib",
            "components": {t: [] for t in ["receiver", "processor", "exporter", "connector", "extension"]},
        }
        manager = _make_mock_inventory_manager(
            versions_by_distribution={"core": [version], "contrib": [version]},
            inventories={("core", version): core_inventory, ("contrib", version): contrib_inventory},
        )
        readme_map = {"badreceiver": "aaa111aaa111", "goodreceiver": "bbb222bbb222"}
        manager.load_component_readme_map.side_effect = lambda dist, ver: readme_map if dist == "core" else {}

        def load_content(dist, ver, name, h):
            if name == "badreceiver":
                raise OSError("simulated disk error reading this one file")
            return f"# {name}"

        manager.load_component_readme_content.side_effect = load_content

        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        exit_code = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert exit_code == 0
        with open(tmp_path / "collector" / "index.json") as f:
            index_data = json.load(f)
        by_name = {c["name"]: c for c in index_data["components"]}

        # goodreceiver's README must still get published even though
        # badreceiver's failed earlier in the same distribution's loop.
        assert by_name["goodreceiver"]["has_readme"] is True
        assert by_name["badreceiver"]["has_readme"] is False

    def test_failed_readme_load_does_not_stamp_markdown_hash(self, tmp_path):
        """If content comes back None, the component must not get markdown_hash
        even though its name was present in the readme map."""
        version = Version("0.150.0")
        core_inventory = {
            "distribution": "core",
            "version": "0.150.0",
            "repository": "opentelemetry-collector",
            "components": {
                "receiver": [{"name": "otlpreceiver", "metadata": {"display_name": "OTLP"}}],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        }
        contrib_inventory = {
            "distribution": "contrib",
            "version": "0.150.0",
            "repository": "opentelemetry-collector-contrib",
            "components": {t: [] for t in ["receiver", "processor", "exporter", "connector", "extension"]},
        }
        manager = _make_mock_inventory_manager(
            versions_by_distribution={"core": [version], "contrib": [version]},
            inventories={("core", version): core_inventory, ("contrib", version): contrib_inventory},
        )
        # otlpreceiver is in the map, but content resolves to None (e.g. the
        # file vanished between the map scan and the read).
        manager.load_component_readme_map.side_effect = lambda dist, ver: (
            {"otlpreceiver": "abc123def456"} if dist == "core" else {}
        )
        manager.load_component_readme_content.return_value = None

        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))
        run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        with open(tmp_path / "collector" / "index.json") as f:
            index_data = json.load(f)
        otlp_entry = next(c for c in index_data["components"] if c["name"] == "otlpreceiver")

        assert otlp_entry["has_readme"] is False
        # No markdown file should have been written either, since content was None.
        markdown_dir = tmp_path / "collector" / "markdown"
        assert not markdown_dir.exists() or list(markdown_dir.glob("*.md")) == []

    def test_write_markdown_failure_for_one_component_does_not_block_the_rest(self, tmp_path):
        """Closes a gap in an earlier fix, which only isolated the read call -
        a write failure (e.g. write_markdown's internal open() raising) must
        be isolated per-component too, not just the read.

        This drives the real write_markdown implementation (patching
        builtins.open selectively) rather than replacing the method with a
        fake that raises, since the real method swallows OSError internally
        and communicates failure via its return value, not an exception.
        """
        version = Version("0.150.0")
        core_inventory = {
            "distribution": "core",
            "version": "0.150.0",
            "repository": "opentelemetry-collector",
            "components": {
                "receiver": [
                    {"name": "badreceiver", "metadata": {"display_name": "Bad"}},
                    {"name": "goodreceiver", "metadata": {"display_name": "Good"}},
                ],
                "processor": [],
                "exporter": [],
                "connector": [],
                "extension": [],
            },
        }
        contrib_inventory = {
            "distribution": "contrib",
            "version": "0.150.0",
            "repository": "opentelemetry-collector-contrib",
            "components": {t: [] for t in ["receiver", "processor", "exporter", "connector", "extension"]},
        }
        manager = _make_mock_inventory_manager(
            versions_by_distribution={"core": [version], "contrib": [version]},
            inventories={("core", version): core_inventory, ("contrib", version): contrib_inventory},
        )
        readme_map = {"badreceiver": "aaa111aaa111", "goodreceiver": "bbb222bbb222"}
        manager.load_component_readme_map.side_effect = lambda dist, ver: readme_map if dist == "core" else {}
        manager.load_component_readme_content.side_effect = lambda dist, ver, name, h: f"# {name}"

        db_writer = CollectorDatabaseWriter(database_dir=str(tmp_path / "collector"))

        import builtins

        real_open = builtins.open

        def selective_open(path, *args, **kwargs):
            # Match on structure (parent dir is exactly "markdown", filename
            # starts with the component name), not a raw substring check -
            # tmp_path itself is derived from this test's function name,
            # which happens to contain "markdown", so a loose substring
            # check on the full path string is not reliable here.
            p = Path(path)
            if p.parent.name == "markdown" and p.name.startswith("badreceiver-"):
                raise OSError("simulated mkdir/disk failure")
            return real_open(path, *args, **kwargs)

        with patch("builtins.open", side_effect=selective_open):
            exit_code = run_collector_builder(inventory_manager=manager, db_writer=db_writer)

        assert exit_code == 0
        with open(tmp_path / "collector" / "index.json") as f:
            index_data = json.load(f)
        by_name = {c["name"]: c for c in index_data["components"]}

        assert by_name["goodreceiver"]["has_readme"] is True
        assert by_name["badreceiver"]["has_readme"] is False

        # No markdown file should exist for the component whose write failed.
        markdown_dir = tmp_path / "collector" / "markdown"
        markdown_files = [p.name for p in markdown_dir.glob("*.md")]
        assert not any("badreceiver" in name for name in markdown_files)
        assert any("goodreceiver" in name for name in markdown_files)
