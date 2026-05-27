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
"""CLI entry point for v1-registry-sync."""

import argparse
import logging
import sys

from v1_registry_sync.reader import read_latest_v2_components
from v1_registry_sync.reporter import write_report

logger = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )


def main() -> None:
    """Generate a dry-run report of proposed V1 registry changes from V2 data."""
    configure_logging()

    parser = argparse.ArgumentParser(
        description=(
            "Read the latest V2 registry snapshot and produce a report showing "
            "which description values would be synced into the matching V1 entries "
            "under opentelemetry.io/data/registry/."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--inventory-dir",
        default="ecosystem-registry/collector",
        help="Path to the ecosystem-registry/collector directory",
    )
    parser.add_argument(
        "--distribution",
        choices=["core", "contrib"],
        default="contrib",
        help="Distribution to read from V2",
    )
    parser.add_argument(
        "--v1-registry-dir",
        default=None,
        help=(
            "Optional path to the opentelemetry.io data/registry/ directory. "
            "When provided, each entry includes a v1_entry_exists flag indicating "
            "whether a matching V1 file is already present."
        ),
    )
    parser.add_argument(
        "--output",
        default="-",
        help="Output file path, or - for stdout",
    )
    parser.add_argument(
        "--format",
        choices=["json", "yaml"],
        default="json",
        help="Output format",
    )
    args = parser.parse_args()

    try:
        logger.info("V1 Registry Sync -- dry-run report")
        logger.info("Inventory directory : %s", args.inventory_dir)
        logger.info("Distribution        : %s", args.distribution)
        if args.v1_registry_dir:
            logger.info("V1 registry dir    : %s", args.v1_registry_dir)
        logger.info("")

        report = read_latest_v2_components(
            inventory_dir=args.inventory_dir,
            distribution=args.distribution,
            v1_registry_dir=args.v1_registry_dir,
        )

        logger.info("")
        logger.info("Registry version : v%s", report.version)
        logger.info("Total components : %d", len(report.components))
        logger.info("")

        if args.output == "-":
            write_report(report, sys.stdout, fmt=args.format)
        else:
            with open(args.output, "w", encoding="utf-8") as f:
                write_report(report, f, fmt=args.format)
            logger.info("Report written to %s", args.output)

    except Exception as e:
        logger.error("Error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
