"""
Update documentation pages.

This script updates OpenTelemetry Collector component documentation tables
in a local opentelemetry.io repository using marker-based updates.
"""

import logging
import sys

from collector_watcher import DistributionName, InventoryManager
from semantic_version import Version

logger = logging.getLogger(__name__)


def get_latest_version(inventory_manager: InventoryManager, distribution: DistributionName) -> Version:
    versions = inventory_manager.list_versions(distribution)
    if not versions:
        print(f"❌ No versions found for {distribution} distribution in inventory.")
        sys.exit(1)

    release_versions = [v for v in versions if not v.prerelease]
    if not release_versions:
        print("❌ No release versions found for contrib distribution in inventory.")
        sys.exit(1)

    version = release_versions[0]

    logger.info(f"Contrib Target version: {version}")
    return version


def merge_inventories(core_inventory: dict, contrib_inventory: dict) -> dict:
    """
    Merge core and contrib inventories into a unified inventory.

    Components in both distributions will have their metadata merged,
    with distributions list showing both.

    Args:
        core_inventory: Core distribution inventory
        contrib_inventory: Contrib distribution inventory

    Returns:
        Merged inventory with unified components
    """
    merged = {"components": {}}

    all_types = set(core_inventory.get("components", {}).keys()) | set(contrib_inventory.get("components", {}).keys())

    for component_type in all_types:
        core_comps = core_inventory.get("components", {}).get(component_type, [])
        contrib_comps = contrib_inventory.get("components", {}).get(component_type, [])

        component_map = {}

        # Add core components
        for comp in core_comps:
            name = comp.get("name")
            # Skip experimental "x" components (e.g., xreceiver, xexporter, xconnector)
            if name == f"x{component_type}":
                continue
            comp_copy = comp.copy()
            comp_copy["source_repo"] = "core"
            component_map[name] = comp_copy

        # Merge or add contrib components
        for comp in contrib_comps:
            name = comp.get("name")
            # Skip experimental "x" components (e.g., xreceiver, xexporter, xconnector)
            if name == f"x{component_type}":
                continue
            if name in component_map:
                # Component exists in both - merge distributions
                # Source repo is CORE because that's where the code lives
                existing = component_map[name]
                existing_dists = existing.get("metadata", {}).get("status", {}).get("distributions", [])
                contrib_dists = comp.get("metadata", {}).get("status", {}).get("distributions", [])

                # Combine and deduplicate distributions
                all_dists = sorted(set(existing_dists) | set(contrib_dists))

                # Update metadata with merged distributions
                if comp.get("metadata") and not existing.get("metadata"):
                    # Contrib has metadata but core doesn't - use contrib's
                    existing["metadata"] = comp["metadata"].copy()

                # Ensure metadata structure exists
                if "metadata" not in existing:
                    existing["metadata"] = {}
                if "status" not in existing["metadata"]:
                    existing["metadata"]["status"] = {}
                existing["metadata"]["status"]["distributions"] = all_dists

                # Keep source_repo as "core" since component is in core repo
            else:
                # Component only in contrib
                comp_copy = comp.copy()
                comp_copy["source_repo"] = "contrib"
                component_map[name] = comp_copy

        # Convert map back to list and sort alphabetically by name for consistent output
        merged["components"][component_type] = sorted(component_map.values(), key=lambda c: c.get("name", ""))

    return merged
