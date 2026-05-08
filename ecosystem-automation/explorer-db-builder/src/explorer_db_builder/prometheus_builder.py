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
"""Orchestrates the Prometheus database build pipeline."""

import logging
from typing import Optional

from prometheus_watcher.inventory_manager import InventoryManager

from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from explorer_db_builder.prometheus_transformer import (
    make_index_component,
    transform_prometheus_components,
)

logger = logging.getLogger(__name__)

DISTRIBUTIONS = ["official", "community"]


class PrometheusDatabaseWriter(CollectorDatabaseWriter):
    """Database writer for Prometheus ecosystem."""

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/prometheus") -> None:
        super().__init__(database_dir)

    def write_index(self, latest_components: list[dict]):
        """Write the per-ecosystem index.json."""
        self.database_dir.mkdir(parents=True, exist_ok=True)

        distributions_seen = sorted(list(set(c["distribution"] for c in latest_components)))
        types_seen = sorted(list(set(c["type"] for c in latest_components)))

        index_data = {
            "ecosystem": "prometheus",
            "taxonomy": {
                "distributions": distributions_seen,
                "types": types_seen,
            },
            "components": [make_index_component(c) for c in latest_components],
        }

        self._write_json(self.database_dir / "index.json", index_data)


def run_prometheus_builder(
    inventory_manager: Optional[InventoryManager] = None,
    db_writer: Optional[PrometheusDatabaseWriter] = None,
    clean: bool = False,
) -> int:
    """Run the Prometheus database builder pipeline."""
    try:
        inventory_manager = inventory_manager or InventoryManager()
        db_writer = db_writer or PrometheusDatabaseWriter()

        if clean:
            db_writer.clean()

        # Get all versions across all distributions
        all_versions = set()
        for dist in DISTRIBUTIONS:
            all_versions.update(inventory_manager.list_release_versions(dist))

        versions = sorted(list(all_versions), reverse=True)
        if not versions:
            logger.warning("No Prometheus versions found")
            return 0

        logger.info("Processing %d Prometheus release version(s)", len(versions))

        processed_versions = []
        latest_components = []

        for version in versions:
            logger.info("Processing Prometheus version: %s", version)
            version_components = []

            for dist in DISTRIBUTIONS:
                inventory = inventory_manager.load_versioned_inventory(dist, version)
                if inventory:
                    components = transform_prometheus_components(inventory, dist)
                    version_components.extend(components)

            if not version_components:
                continue

            component_map = db_writer.write_components(version_components)
            db_writer.write_version_index(version, component_map)

            processed_versions.append(version)
            if not latest_components:
                latest_components = version_components

        if processed_versions:
            db_writer.write_version_list(processed_versions)
            db_writer.write_index(latest_components)

        logger.info("✓ Prometheus database build completed successfully")
        return 0

    except Exception as e:
        logger.error("❌ Unexpected error in Prometheus builder: %s", e, exc_info=True)
        return 1
