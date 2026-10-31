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
import hashlib
import json
import logging
import sys
from pathlib import Path

import yaml

from .client import DEFAULT_REPORT_PATH, DEFAULT_REPOSITORY, SHA_RE, ConformanceClient
from .validator import is_safe_repository_path, validate_report

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = "ecosystem-registry/conformance"


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Watch and import published semantic-convention conformance reports.")
    parser.add_argument(
        "--revision",
        default=None,
        help="Git revision (commit SHA, branch, or tag) to import. Defaults to the last commit modifying the report.",
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
        help="Validate the existing local report.json and source.yaml without fetching from upstream",
    )
    return parser.parse_args(args)


def validate_existing(output_dir: Path) -> int:
    """Validate existing local report.json and source.yaml."""
    report_file = output_dir / "report.json"
    source_file = output_dir / "source.yaml"

    if not report_file.exists():
        logger.error("Missing report.json in %s", output_dir)
        return 1
    if not source_file.exists():
        logger.error("Missing source.yaml in %s", output_dir)
        return 1

    try:
        report_bytes = report_file.read_bytes()
        report_data = json.loads(report_bytes.decode("utf-8"))
        validate_report(report_data)
    except Exception as e:
        logger.error("Validation error for %s: %s", report_file, e)
        return 1

    try:
        with open(source_file, "r", encoding="utf-8") as f:
            source_data = yaml.safe_load(f)
        if not isinstance(source_data, dict):
            logger.error("%s is not a valid YAML mapping", source_file)
            return 1

        required_fields = ("repository", "revision", "report_path", "schema_version", "digest")
        for field in required_fields:
            if field not in source_data:
                logger.error("%s missing required field '%s'", source_file, field)
                return 1

        revision = source_data.get("revision", "")
        if not SHA_RE.match(str(revision)):
            logger.error("%s has invalid commit revision '%s'", source_file, revision)
            return 1

        report_path = source_data.get("report_path", "")
        if not is_safe_repository_path(str(report_path)):
            logger.error("%s has unsafe report_path '%s'", source_file, report_path)
            return 1

        expected_digest = f"sha256:{hashlib.sha256(report_bytes).hexdigest()}"
        if source_data.get("digest") != expected_digest:
            logger.error(
                "Digest mismatch in %s: expected %s, found %s",
                source_file,
                expected_digest,
                source_data.get("digest"),
            )
            return 1
    except Exception as e:
        logger.error("Validation error for %s: %s", source_file, e)
        return 1

    logger.info("Validation passed successfully for %s", output_dir)
    return 0


def run_sync(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir)

    if args.validate_only:
        return validate_existing(output_dir)

    client = ConformanceClient(repository=args.repo)

    logger.info("Resolving upstream revision for repository '%s'...", args.repo)
    revision = client.resolve_revision(args.revision, report_path=args.report_path)
    logger.info("Resolved revision to immutable commit SHA: %s", revision)

    logger.info("Fetching report from %s at %s:%s...", args.repo, revision, args.report_path)
    report_data, formatted_bytes, digest = client.fetch_report(revision, args.report_path)
    logger.info("Computed report digest: %s", digest)

    report_file = output_dir / "report.json"
    source_file = output_dir / "source.yaml"

    # Idempotency check: if committed report.json matches incoming content, write nothing and exit 0
    if report_file.exists():
        try:
            existing_bytes = report_file.read_bytes()
            if existing_bytes == formatted_bytes:
                logger.info("Report content matches committed report.json; skipping update.")
                return 0
        except OSError as e:
            logger.warning("Could not read existing %s: %s", report_file, e)

    # Validate report data before writing to disk
    try:
        logger.info("Validating report schema and target constraints...")
        validate_report(report_data)
        logger.info("Validation successful.")
    except Exception as e:
        logger.error("Validation failed: %s", e)
        return 1

    # Atomic write to temporary files
    output_dir.mkdir(parents=True, exist_ok=True)
    tmp_report = output_dir / ".report.json.tmp"
    tmp_source = output_dir / ".source.yaml.tmp"

    source_data = {
        "repository": args.repo,
        "revision": revision,
        "report_path": args.report_path,
        "schema_version": report_data.get("schema_version", 1),
        "digest": digest,
    }

    try:
        with open(tmp_report, "wb") as f:
            f.write(formatted_bytes)

        with open(tmp_source, "w", encoding="utf-8") as f:
            yaml.safe_dump(source_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        tmp_report.replace(report_file)
        tmp_source.replace(source_file)
        logger.info(
            "Successfully updated conformance report (%d targets) at revision %s (digest: %s)",
            len(report_data.get("targets", [])),
            revision,
            digest,
        )
        return 0

    except Exception as e:
        logger.error("Failed to write conformance report: %s", e)
        if tmp_report.exists():
            tmp_report.unlink(missing_ok=True)
        if tmp_source.exists():
            tmp_source.unlink(missing_ok=True)
        return 1


def main() -> None:
    args = parse_args()
    exit_code = run_sync(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
