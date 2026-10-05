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
"""Tests for SnapshotInventoryManager."""

from pathlib import Path

from watcher_common.inventory_manager import SnapshotInventoryManager, SnapshotRecord


def test_snapshot_inventory_manager_initialization(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)
    assert mgr.inventory_dir == tmp_path
    assert mgr.snapshots_dir == tmp_path / "snapshots"
    assert mgr.index_file == tmp_path / "index.yaml"
    assert mgr.current_file == tmp_path / "current.yaml"
    assert mgr.list_snapshots() == []
    assert mgr.get_current_snapshot() is None
    assert not mgr.has_digest("sha256:abc")


def test_snapshot_inventory_manager_register_and_query(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)
    record1 = SnapshotRecord(
        id="a1b2c3d4e5f6",
        content_digest="sha256:a1b2c3d4e5f6...",
        source_repository="open-telemetry/semantic-conventions-conformance",
        source_revision="6f85d0aa70eb55116d161c5c0737a6ba55faf101",
        upstream_schema_version=1,
        target_count=130,
        path="snapshots/a1b2c3d4e5f6",
    )

    mgr.register_snapshot(record1, set_as_current=True)

    assert mgr.has_digest("sha256:a1b2c3d4e5f6...")
    assert not mgr.has_digest("sha256:nonexistent")

    current = mgr.get_current_snapshot()
    assert current is not None
    assert current["snapshot_id"] == "a1b2c3d4e5f6"
    assert current["source_revision"] == "6f85d0aa70eb55116d161c5c0737a6ba55faf101"

    loaded_record = mgr.get_snapshot_by_id("a1b2c3d4e5f6")
    assert loaded_record is not None
    assert loaded_record["target_count"] == 130

    # Register second snapshot
    record2 = SnapshotRecord(
        id="b2c3d4e5f6a1",
        content_digest="sha256:b2c3d4e5f6a1...",
        source_repository="open-telemetry/semantic-conventions-conformance",
        source_revision="7e95d0aa70eb55116d161c5c0737a6ba55faf102",
        upstream_schema_version=1,
        target_count=135,
        path="snapshots/b2c3d4e5f6a1",
    )
    mgr.register_snapshot(record2, set_as_current=True)

    assert len(mgr.list_snapshots()) == 2
    current2 = mgr.get_current_snapshot()
    assert current2 is not None
    assert current2["snapshot_id"] == "b2c3d4e5f6a1"


def test_snapshot_exists_check(tmp_path: Path) -> None:
    mgr = SnapshotInventoryManager(tmp_path)
    snap_dir = mgr.get_snapshot_dir("test12345678")
    assert not mgr.snapshot_exists("test12345678")

    snap_dir.mkdir(parents=True)
    (snap_dir / "report.json").write_text("{}", encoding="utf-8")
    assert not mgr.snapshot_exists("test12345678")

    (snap_dir / "envelope.yaml").write_text("schema_version: '1.0.0'", encoding="utf-8")
    assert mgr.snapshot_exists("test12345678")
