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

import yaml
from collector_watcher.inventory_manager import InventoryManager

from .models import STABILITY_PRIORITY, ComponentSyncData, V1SyncReport

logger = logging.getLogger(__name__)

# Base Go module paths for each distribution.
DIST_MODULE_BASE = {
    "contrib": "github.com/open-telemetry/opentelemetry-collector-contrib",
    "core": "github.com/open-telemetry/opentelemetry-collector",
}


def _most_stable_level(stability: Optional[dict]) -> Optional[str]:
    """Return the highest-priority stability level present across all signals."""
    if not stability:
        return None
    for level in STABILITY_PRIORITY:
        if level in stability:
            return level
    return None


def _build_go_module_path(distribution: str, component_type: str, name: str) -> str:
    """Construct the Go module path for a V2 component.

    Both registries use the same path format:
      github.com/open-telemetry/opentelemetry-collector-contrib/{component_type}/{name}
    """
    base = DIST_MODULE_BASE.get(
        distribution,
        f"github.com/open-telemetry/opentelemetry-collector-{distribution}",
    )
    return f"{base}/{component_type}/{name}"


def _build_v1_index(v1_registry_dir: Path) -> dict[str, str]:
    """Build a mapping of go_module_path -> v1_filename from all V1 YAML files.

    Each V1 collector file stores its Go module path in the ``package.name``
    field (e.g. ``github.com/open-telemetry/opentelemetry-collector-contrib/
    receiver/kafkareceiver``). This index lets us match V2 components to their
    V1 counterparts without relying on naming conventions, which are inconsistent.
    """
    index: dict[str, str] = {}
    for yaml_file in v1_registry_dir.glob("*.yml"):
        try:
            with open(yaml_file, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            pkg_name = (data.get("package") or {}).get("name")
            if pkg_name:
                index[pkg_name] = yaml_file.name
        except Exception:
            logger.debug("Could not parse V1 file: %s", yaml_file)
    return index


def read_latest_v2_components(
    inventory_dir: str = "ecosystem-registry/collector",
    distribution: str = "contrib",
    v1_registry_dir: Optional[str] = None,
) -> V1SyncReport:
    """Read V2 registry data for the latest release version of a distribution.

    Args:
        inventory_dir: Path to the ecosystem-registry/collector directory.
        distribution: Either 'core' or 'contrib'.
        v1_registry_dir: Optional path to opentelemetry.io data/registry/.
            When provided, a go-module-path index is built from the V1 files
            so that each entry's target_v1_file and v1_entry_exists fields
            reflect actual matches rather than predicted naming conventions.

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

    v1_index: dict[str, str] = {}
    if v1_registry_dir is not None:
        v1_index = _build_v1_index(Path(v1_registry_dir))
        logger.info("Loaded V1 index: %d entries", len(v1_index))

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

            go_module_path = _build_go_module_path(distribution, component_type, name)
            matched_v1_file = v1_index.get(go_module_path, "")

            components.append(
                ComponentSyncData(
                    name=name,
                    component_type=component_type,
                    distribution=distribution,
                    display_name=metadata.get("display_name") or None,
                    description=metadata.get("description") or None,
                    stability=stability,
                    expected_go_module_path=go_module_path,
                    target_v1_file=matched_v1_file,
                    v1_entry_exists=bool(matched_v1_file),
                )
            )

        logger.info("  %s: loaded %d components", component_type, len(component_list))

    return V1SyncReport(
        version=str(latest),
        distribution=distribution,
        components=components,
    )
