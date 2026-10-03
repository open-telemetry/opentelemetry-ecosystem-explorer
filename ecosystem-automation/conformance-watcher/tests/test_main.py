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
"""End-to-end and CLI tests for conformance-watcher."""

import argparse
from pathlib import Path
from unittest.mock import MagicMock, patch

from conformance_watcher.main import parse_args, run_sync
from watcher_common.inventory_manager import SnapshotInventoryManager


def create_sample_report(target_name: str = "http/go/net-http") -> dict:
    return {
        "schema_version": 1,
        "domains": {
            "http-conformance": {
                "registry_dir": "model",
                "registry_ref": "v1.44.0",
                "registry_repo": "open-telemetry/semantic-conventions",
            }
        },
        "registry": {
            "http-conformance": {
                "spans": {},
            }
        },
        "targets": [
            {
                "id": target_name,
                "runner": "http-conformance",
                "domain": "http",
                "language": "go",
                "path": f"scenarios/{target_name}",
            }
        ],
    }


def test_parse_args_defaults() -> None:
    args = parse_args([])
    assert args.revision == "main"
    assert args.repo == "open-telemetry/semantic-conventions-conformance"
    assert args.output_dir == "ecosystem-registry/conformance"
    assert not args.validate_only
    assert not args.force


def test_run_sync_initial_import_and_idempotency(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)
    sample_data = create_sample_report()

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.resolve_revision.return_value = "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
        mock_client.fetch_report.return_value = (
            sample_data,
            b"canonical-bytes",
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "1234567890ab",
        )

        args = argparse.Namespace(
            revision="6f85d0aa70eb55116d161c5c0737a6ba55faf101",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
            force=False,
        )

        # 1. First sync: imports snapshot
        code = run_sync(args)
        assert code == 0
        assert mgr.snapshot_exists("1234567890ab")
        current = mgr.get_current_snapshot()
        assert current is not None
        assert current["snapshot_id"] == "1234567890ab"
        assert len(mgr.list_snapshots()) == 1

        # 2. Second sync with different commit SHA but identical content: zero diff / skip write
        mock_client.resolve_revision.return_value = "unrelatedcommit0000000000000000000000000"
        # fetch_report returns same digest
        mock_client.fetch_report.return_value = (
            sample_data,
            b"canonical-bytes",
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "1234567890ab",
        )
        code2 = run_sync(args)
        assert code2 == 0
        # Snapshot count remains 1, no duplicate entries
        assert len(mgr.list_snapshots()) == 1


def test_run_sync_new_content_creates_new_snapshot(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        # Initial run
        mock_client.resolve_revision.return_value = "commit11111111111111111111111111111111111"
        mock_client.fetch_report.return_value = (
            create_sample_report("target1"),
            b"bytes1",
            "1111111111111111111111111111111111111111111111111111111111111111",
            "111111111111",
        )
        args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
            force=False,
        )
        assert run_sync(args) == 0

        # Changed report run
        mock_client.resolve_revision.return_value = "commit22222222222222222222222222222222222"
        mock_client.fetch_report.return_value = (
            create_sample_report("target2"),
            b"bytes2",
            "2222222222222222222222222222222222222222222222222222222222222222",
            "222222222222",
        )
        assert run_sync(args) == 0

        snapshots = mgr.list_snapshots()
        assert len(snapshots) == 2
        assert [s["id"] for s in snapshots] == ["111111111111", "222222222222"]
        current = mgr.get_current_snapshot()
        assert current is not None
        assert current["snapshot_id"] == "222222222222"


def test_run_sync_validation_failure_preserves_previous(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        # Initial valid snapshot
        mock_client.resolve_revision.return_value = "commit1"
        mock_client.fetch_report.return_value = (
            create_sample_report("target1"),
            b"bytes1",
            "1111111111111111111111111111111111111111111111111111111111111111",
            "111111111111",
        )
        args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
            force=False,
        )
        assert run_sync(args) == 0

        # Second run with invalid schema version
        invalid_data = create_sample_report("target2")
        invalid_data["schema_version"] = 99
        mock_client.resolve_revision.return_value = "commit2"
        mock_client.fetch_report.return_value = (
            invalid_data,
            b"invalid_bytes",
            "9999999999999999999999999999999999999999999999999999999999999999",
            "999999999999",
        )

        with patch("conformance_watcher.main.validate_report", side_effect=ValueError("Invalid")):
            code = run_sync(args)
            assert code == 1

        # State preserved
        snapshots = mgr.list_snapshots()
        assert len(snapshots) == 1
        assert snapshots[0]["id"] == "111111111111"
        current = mgr.get_current_snapshot()
        assert current is not None
        assert current["snapshot_id"] == "111111111111"


def test_validate_only_mode(tmp_path: Path) -> None:
    sample_data = create_sample_report()

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.resolve_revision.return_value = "commit1"
        mock_client.fetch_report.return_value = (
            sample_data,
            b"bytes",
            "1111111111111111111111111111111111111111111111111111111111111111",
            "111111111111",
        )
        sync_args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
            force=False,
        )
        assert run_sync(sync_args) == 0

    val_args = argparse.Namespace(
        revision="main",
        repo="open-telemetry/semantic-conventions-conformance",
        report_path="docs/data/conformance.json",
        output_dir=str(tmp_path),
        validate_only=True,
        force=False,
    )
    assert run_sync(val_args) == 0
