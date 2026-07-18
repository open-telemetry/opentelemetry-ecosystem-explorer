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
"""Orchestrates the collector database build pipeline."""

import logging
from pathlib import Path
from typing import Optional

from collector_watcher.inventory_manager import InventoryManager
from semantic_version import Version

from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from explorer_db_builder.collector_display_name_audit import (
    find_missing_display_names,
    write_missing_display_name_report,
)
from explorer_db_builder.collector_transformer import make_index_component, transform_collector_components
from explorer_db_builder.ecosystem_stats import count_unique_collector_component_ids

logger = logging.getLogger(__name__)

DISTRIBUTIONS = ["core", "contrib"]

# Only build the database for versions >= this. Keeps the output bounded and
# avoids including very old registry data that pre-dates reliable metadata.
MINIMUM_VERSION = Version("0.150.0")


def _get_merged_release_versions(inventory_manager: InventoryManager) -> list[Version]:
    """Collect the union of release versions from all distributions, sorted latest-first.

    Only versions >= MINIMUM_VERSION are included.

    Args:
        inventory_manager: Collector inventory manager.

    Returns:
        Deduplicated, sorted (newest-first) list of release versions >= MINIMUM_VERSION.

    Raises:
        ValueError: If no qualifying release versions exist across any distribution.
    """
    version_set: set[Version] = set()
    for distribution in DISTRIBUTIONS:
        versions = inventory_manager.list_release_versions(distribution)
        version_set.update(v for v in versions if v >= MINIMUM_VERSION)

    if not version_set:
        raise ValueError(f"No release versions >= {MINIMUM_VERSION} found in collector inventory")

    return sorted(version_set, reverse=True)


def _process_version(
    version: Version,
    inventory_manager: InventoryManager,
    db_writer: CollectorDatabaseWriter,
) -> tuple[dict[str, str], list[dict], str]:
    """Load, transform, and write all components for a single version.

    Loads data from every distribution and merges into one flat component list.

    Also loads each distribution's component README map (if any), publishes
    the underlying markdown content, and stamps a markdown_hash onto matching
    components. Only components whose README was actually loaded and
    published successfully get a markdown_hash - a failure loading or
    publishing one component's README is logged and only excludes that
    component, not the rest of the distribution.

    Args:
        version: The version to process.
        inventory_manager: Source of raw registry data.
        db_writer: Destination writer.

    Returns:
        Tuple of (component_map, components, bundle_hash) where component_map is
        {component_id: hash}, components is the flat list of full canonical dicts
        (for the latest-version index), and bundle_hash identifies the
        consolidated per-version bundle. component_map/components are empty and
        bundle_hash is "" if no components were found.
    """
    logger.info("Processing collector version: %s", version)
    all_components = []

    for distribution in DISTRIBUTIONS:
        inventory = inventory_manager.load_versioned_inventory(distribution, version)

        published_readmes: dict[str, str] = {}
        try:
            readme_map = inventory_manager.load_component_readme_map(distribution, version)
            for component_name, markdown_hash in readme_map.items():
                try:
                    content = inventory_manager.load_component_readme_content(
                        distribution, version, component_name, markdown_hash
                    )
                    if content is not None and db_writer.write_markdown(component_name, markdown_hash, content):
                        published_readmes[component_name] = markdown_hash
                except OSError as e:
                    # Defensive: neither load_component_readme_content nor
                    # write_markdown currently raise OSError (both swallow
                    # their own failures and signal via return value - see
                    # `content is not None and db_writer.write_markdown(...)`
                    # above, which is what actually gates the stamp). This
                    # stays as a safety net in case that changes, so one
                    # component's failure still can't take down the rest of
                    # this distribution's READMEs or the component inventory.
                    logger.warning(
                        "  Failed to load/publish README for component '%s' in %s %s: %s",
                        component_name,
                        distribution,
                        version,
                        e,
                    )
        except OSError as e:
            # Covers a failure in load_component_readme_map itself (e.g. the
            # component_readmes directory becoming unreadable mid-scan).
            logger.warning("  Failed to load component READMEs for %s %s: %s", distribution, version, e)

        components = transform_collector_components(inventory, distribution, published_readmes)
        logger.info("  %s: %d components", distribution, len(components))
        all_components.extend(components)

    logger.info("  Total: %d components", len(all_components))

    if not all_components:
        logger.warning("No components found for version %s, skipping", version)
        return {}, [], ""

    component_map = db_writer.write_components(all_components)
    db_writer.write_version_index(version, component_map)

    # Consolidated per-version bundle the list view loads in a single request.
    # Slim (make_index_component) shape; full detail stays in components/.
    bundle_items = [make_index_component(c) for c in all_components]
    bundle_hash = db_writer.write_version_bundle(version, bundle_items)
    return component_map, all_components, bundle_hash


def run_collector_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[CollectorDatabaseWriter] = None,
    clean: bool = False,
    audit_report_path: Optional[str] = None,
) -> int:
    """Run the collector database builder pipeline.

    Args:
        inventory_manager: Optional override for testing.
        db_writer: Optional override for testing.
        clean: If True, wipe the output directory before building.
        audit_report_path: If set, write a JSON report of latest-release components
            missing a display_name to this path (a build artifact, not part of the
            database, so it must live outside the database directory).

    Returns:
        Exit code: 0 for success, 1 for failure.
    """
    try:
        inventory_manager = inventory_manager or InventoryManager()
        db_writer = db_writer or CollectorDatabaseWriter()

        if clean:
            db_writer.clean()

        versions = _get_merged_release_versions(inventory_manager)
        logger.info("Processing %d collector release version(s)", len(versions))

        processed_versions: list[Version] = []
        latest_components: list[dict] = []
        components_by_version: list[list[dict]] = []
        bundle_hashes: dict[Version, str] = {}

        for version in versions:
            component_map, components, bundle_hash = _process_version(version, inventory_manager, db_writer)
            if not component_map:
                continue

            processed_versions.append(version)
            bundle_hashes[version] = bundle_hash
            components_by_version.append(components)
            if not latest_components:
                latest_components = components

        if not processed_versions:
            raise ValueError("No collector versions were successfully processed")

        db_writer.write_version_list(processed_versions, bundle_hashes)
        db_writer.write_index(latest_components)

        db_writer.write_ecosystem_stats(
            {
                "version_count": len(processed_versions),
                "component_count": count_unique_collector_component_ids(components_by_version),
            }
        )

        if audit_report_path:
            # Enforce the "outside the database directory" invariant: a report written
            # inside it would be committed and bump DB_VERSION. Fail fast if so.
            report_path = Path(audit_report_path).resolve()
            db_dir = db_writer.database_dir.resolve()
            if report_path == db_dir or db_dir in report_path.parents:
                raise ValueError(f"audit report path {report_path} must be outside the database directory {db_dir}")

            # Latest release only: that's the version fixable upstream today.
            missing = find_missing_display_names(latest_components)
            write_missing_display_name_report(audit_report_path, str(processed_versions[0]), missing)
            logger.info("Collector components missing display_name (latest release): %d", len(missing))

        stats = db_writer.get_stats()
        total_mb = stats["total_bytes"] / (1024 * 1024)

        logger.info("")
        logger.info("Collector Database Statistics:")
        logger.info("  Files written: %d", stats["files_written"])
        logger.info("  Total size: %d bytes (%.2f MB)", stats["total_bytes"], total_mb)
        logger.info("")
        logger.info("✓ Collector database build completed successfully")
        return 0

    except ValueError as e:
        logger.error("❌ Validation error: %s", e)
        return 1
    except KeyError as e:
        logger.error("❌ Data structure error: %s", e)
        return 1
    except OSError as e:
        logger.error("❌ File system error: %s", e)
        return 1
    except Exception as e:
        logger.error("❌ Unexpected error: %s", e, exc_info=True)
        return 1
