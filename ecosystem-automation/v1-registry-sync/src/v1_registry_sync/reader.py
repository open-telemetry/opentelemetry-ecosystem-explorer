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
from semantic_version import Version

from .models import STABILITY_PRIORITY, ComponentSyncData, V1SyncReport

COMPONENT_TYPES = ["connector", "exporter", "extension", "processor", "receiver"]

logger = logging.getLogger(__name__)


def _most_stable_level(stability: Optional[dict]) -> Optional[str]:
    """Return the highest-priority stability level present across all signals."""
    if not stability:
        return None
    for level in STABILITY_PRIORITY:
        if level in stability:
            return level
    return None


def _find_latest_version(distribution_dir: Path) -> Optional[str]:
    """Return the name of the highest version directory (e.g. 'v0.151.0')."""
    version_dirs = [d.name for d in distribution_dir.iterdir() if d.is_dir() and d.name.startswith("v")]
    if not version_dirs:
        return None
    return sorted(version_dirs, key=lambda v: Version(v.lstrip("v")))[-1]


def _parse_component_file(yaml_path: Path, distribution: str) -> list[ComponentSyncData]:
    """Parse a single component-type YAML file and return sync data for each entry."""
    with open(yaml_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not data or "components" not in data:
        return []

    component_type = data.get("component_type", yaml_path.stem)
    results: list[ComponentSyncData] = []

    for component in data["components"]:
        name = component.get("name", "")
        metadata = component.get("metadata", {}) or {}
        status = metadata.get("status", {}) or {}

        stability_raw = status.get("stability")
        stability = _most_stable_level(stability_raw)

        results.append(
            ComponentSyncData(
                name=name,
                component_type=component_type,
                distribution=distribution,
                display_name=metadata.get("display_name") or None,
                description=metadata.get("description") or None,
                stability=stability,
            )
        )

    return results


def read_latest_v2_components(
    inventory_dir: str = "ecosystem-registry/collector",
    distribution: str = "contrib",
) -> V1SyncReport:
    """Read V2 registry data for the latest version of a distribution.

    Args:
        inventory_dir: Path to the ecosystem-registry/collector directory.
        distribution: Either 'core' or 'contrib'.

    Returns:
        A V1SyncReport containing proposed changes for each component.
    """
    base = Path(inventory_dir) / distribution
    if not base.exists():
        raise FileNotFoundError(f"Distribution directory not found: {base}")

    latest = _find_latest_version(base)
    if not latest:
        raise ValueError(f"No versioned data found in {base}")

    version_dir = base / latest
    components: list[ComponentSyncData] = []

    for component_type in COMPONENT_TYPES:
        yaml_file = version_dir / f"{component_type}.yaml"
        if yaml_file.exists():
            found = _parse_component_file(yaml_file, distribution)
            components.extend(found)
            logger.info("  %s: loaded %d components", component_type, len(found))

    return V1SyncReport(
        version=latest.lstrip("v"),
        distribution=distribution,
        components=components,
    )
