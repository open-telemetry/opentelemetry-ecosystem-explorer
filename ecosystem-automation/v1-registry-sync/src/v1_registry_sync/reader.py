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
"""Reads V2 ecosystem-registry data and extracts fields for V1 sync."""

import logging
from pathlib import Path
from typing import Optional

from collector_watcher.inventory_manager import InventoryManager

from .models import STABILITY_PRIORITY, ComponentSyncData, V1SyncReport

logger = logging.getLogger(__name__)


def _most_stable_level(stability: Optional[dict]) -> Optional[str]:
    """Return the highest-priority stability level present across all signals."""
    if not stability:
        return None
    for level in STABILITY_PRIORITY:
        if level in stability:
            return level
    return None


def read_latest_v2_components(
    inventory_dir: str = "ecosystem-registry/collector",
    distribution: str = "contrib",
    v1_registry_dir: Optional[str] = None,
) -> V1SyncReport:
    """Read V2 registry data for the latest release version of a distribution.

    Args:
        inventory_dir: Path to the ecosystem-registry/collector directory.
        distribution: Either 'core' or 'contrib'.
        v1_registry_dir: Optional path to opentelemetry.io data/registry/ directory.
            When provided, each entry's v1_entry_exists field reflects whether the
            expected V1 file is present on disk.

    Returns:
        A V1SyncReport containing proposed changes for each component.
    """
    dist_dir = Path(inventory_dir) / distribution
    if not dist_dir.exists():
        raise FileNotFoundError(f"Distribution directory not found: {dist_dir}")

    inventory_manager = InventoryManager(inventory_dir)
    release_versions = inventory_manager.list_release_versions(distribution)
    if not release_versions:
        raise ValueError(f"No release versions found for distribution '{distribution}'")

    latest = release_versions[0]  # list is sorted newest-first
    inventory = inventory_manager.load_versioned_inventory(distribution, latest)

    v1_dir = Path(v1_registry_dir) if v1_registry_dir else None
    components: list[ComponentSyncData] = []

    for component_type, component_list in inventory["components"].items():
        if not component_list:
            continue

        for component in component_list:
            name = component.get("name", "")
            metadata = component.get("metadata", {}) or {}
            status = metadata.get("status", {}) or {}

            stability_raw = status.get("stability")
            stability = _most_stable_level(stability_raw)

            target_v1_file = f"collector-{name}.yml"
            v1_entry_exists = False
            if v1_dir is not None:
                v1_entry_exists = (v1_dir / target_v1_file).exists()

            components.append(
                ComponentSyncData(
                    name=name,
                    component_type=component_type,
                    distribution=distribution,
                    display_name=metadata.get("display_name") or None,
                    description=metadata.get("description") or None,
                    stability=stability,
                    target_v1_file=target_v1_file,
                    v1_entry_exists=v1_entry_exists,
                )
            )

        logger.info("  %s: loaded %d components", component_type, len(component_list))

    return V1SyncReport(
        version=str(latest),
        distribution=distribution,
        components=components,
    )
