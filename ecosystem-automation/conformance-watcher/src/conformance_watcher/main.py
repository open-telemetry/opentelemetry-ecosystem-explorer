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
"""Main CLI entry point for the semantic-convention conformance watcher."""

import argparse
import json
import logging
import shutil
import sys
from pathlib import Path

import yaml
from watcher_common.inventory_manager import SnapshotInventoryManager, SnapshotRecord

from .client import DEFAULT_REPORT_PATH, DEFAULT_REPOSITORY, ConformanceClient
from .transformer import build_envelope, transform_targets
from .validator import validate_report

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = "ecosystem-registry/conformance"


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Watch and import published semantic-convention conformance reports.")
    parser.add_argument(
        "--revision",
        default="main",
        help="Git revision (branch, tag, or 40-char commit SHA) to import (default: main)",
    )
    parser.add_argument(
        "--repo",
        default=DEFAULT_REPOSITORY,
        help=f"Upstream GitHub repository (default: {DEFAULT_REPOSITORY})",
    )
    parser.add_argument(
        "--report-path",
        default=DEFAULT_REPORT_PATH,
        help=f"Report file path in repository (default: {DEFAULT_REPORT_PATH})",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Registry directory path (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate the existing local inventory without fetching from upstream",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force snapshot creation and registration even if digest already exists",
    )
    return parser.parse_args(args)


def validate_existing_inventory(output_dir: Path) -> int:
    """Validate all existing snapshots recorded in the inventory index."""
    mgr = SnapshotInventoryManager(output_dir)
    index = mgr.load_index()
    snapshots = index.get("snapshots", [])

    if not snapshots:
        logger.info("No snapshots found in inventory at %s", output_dir)
        return 0

    current = mgr.get_current_snapshot()
    logger.info(
        "Validating %d snapshot(s) in inventory. Current snapshot ID: %s",
        len(snapshots),
        current.get("snapshot_id") if current else "None",
    )

    for snap in snapshots:
        snap_id = snap.get("id")
        snap_dir = mgr.get_snapshot_dir(snap_id)
        if not snap_dir.exists():
            logger.error("Snapshot directory missing: %s", snap_dir)
            return 1

        report_file = snap_dir / "report.json"
        envelope_file = snap_dir / "envelope.yaml"
        targets_file = snap_dir / "targets.yaml"

        if not report_file.exists():
            logger.error("Missing report.json in %s", snap_dir)
            return 1
        if not envelope_file.exists():
            logger.error("Missing envelope.yaml in %s", snap_dir)
            return 1
        if not targets_file.exists():
            logger.error("Missing targets.yaml in %s", snap_dir)
            return 1

        try:
            with open(report_file, "r", encoding="utf-8") as f:
                report_data = json.load(f)
            validate_report(report_data)
        except Exception as e:
            logger.error("Validation error for snapshot %s: %s", snap_id, e)
            return 1

    logger.info("Inventory validation passed successfully for %d snapshot(s).", len(snapshots))
    return 0


def run_sync(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir)

    if args.validate_only:
        return validate_existing_inventory(output_dir)

    mgr = SnapshotInventoryManager(output_dir)
    client = ConformanceClient(repository=args.repo)

    logger.info("Resolving upstream revision '%s' for repository '%s'...", args.revision, args.repo)
    revision = client.resolve_revision(args.revision)
    logger.info("Resolved revision to immutable commit SHA: %s", revision)

    logger.info("Fetching report from %s at %s:%s...", args.repo, revision, args.report_path)
    report_data, canonical_bytes, full_digest, snapshot_id = client.fetch_report(revision, args.report_path)
    content_digest = f"sha256:{full_digest}"
    logger.info("Computed report digest: %s (snapshot ID: %s)", content_digest, snapshot_id)

    # Idempotency check: if digest already exists in index and not forced, exit with 0
    if mgr.has_digest(content_digest) and not args.force:
        logger.info(
            "Identical report content digest %s already exists in inventory. Skipping write (zero diff).",
            content_digest,
        )
        return 0

    # Validate report data before any disk writes
    try:
        logger.info("Validating report schema and target constraints...")
        validate_report(report_data)
        logger.info("Validation successful.")
    except Exception as e:
        logger.error("Validation failed: %s", e)
        return 1

    # Atomic write to temporary staging directory
    staging_dir = output_dir / f".tmp-snapshot-{snapshot_id}"
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. report.json
        with open(staging_dir / "report.json", "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, sort_keys=True)
            f.write("\n")

        # 2. envelope.yaml
        envelope = build_envelope(
            report_data=report_data,
            source_repository=args.repo,
            source_revision=revision,
            report_path=args.report_path,
            content_digest=content_digest,
        )
        with open(staging_dir / "envelope.yaml", "w", encoding="utf-8") as f:
            yaml.safe_dump(envelope, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        # 3. targets.yaml
        targets = transform_targets(
            report_data=report_data,
            source_repository=args.repo,
            source_revision=revision,
        )
        with open(staging_dir / "targets.yaml", "w", encoding="utf-8") as f:
            yaml.safe_dump(targets, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        # Move staging dir to final destination
        final_dir = mgr.get_snapshot_dir(snapshot_id)
        if final_dir.exists():
            shutil.rmtree(final_dir)
        final_dir.parent.mkdir(parents=True, exist_ok=True)
        staging_dir.rename(final_dir)

        # Register in index.yaml and update current.yaml
        record = SnapshotRecord(
            id=snapshot_id,
            content_digest=content_digest,
            source_repository=args.repo,
            source_revision=revision,
            upstream_schema_version=report_data.get("schema_version", 1),
            target_count=len(report_data.get("targets", [])),
            path=f"snapshots/{snapshot_id}",
        )
        mgr.register_snapshot(record, set_as_current=True)
        logger.info(
            "Successfully published snapshot '%s' (%d targets) at revision %s.",
            snapshot_id,
            record.target_count,
            revision,
        )
        return 0

    except Exception as e:
        logger.error("Failed to write snapshot: %s", e)
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        return 1


def main() -> None:
    args = parse_args()
    exit_code = run_sync(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
