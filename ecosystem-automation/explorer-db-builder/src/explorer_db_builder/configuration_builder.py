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
"""Builds resolved configuration schema JSON from registry YAML files."""

import json
import logging
import shutil
from pathlib import Path
from typing import Any

import yaml
from watcher_common.inventory_manager import BaseInventoryManager

from explorer_db_builder.schema_resolver import SchemaResolver
from explorer_db_builder.schema_ui_mapper import map_schema_to_ui_tree

logger = logging.getLogger(__name__)

ROOT_SCHEMA_FILE = "opentelemetry_configuration.yaml"

REGISTRY_DIR = "ecosystem-registry/configuration"
OUTPUT_DIR = "ecosystem-explorer/public/data/configuration"


def _load_yaml_registry(version_dir: Path) -> dict[str, Any]:
    """Load all YAML files from a version directory into a registry dict."""
    registry = {}
    for yaml_file in sorted(version_dir.glob("*.yaml")):
        with open(yaml_file, encoding="utf-8") as f:
            registry[yaml_file.name] = yaml.safe_load(f)
    return registry


def run_configuration_builder(
    registry_dir: str = REGISTRY_DIR,
    output_dir: str = OUTPUT_DIR,
    clean: bool = False,
) -> int:
    """Build resolved configuration JSON from registry YAML schemas. Returns 0 on success, 1 on failure."""
    try:
        output_path = Path(output_dir)

        if clean and output_path.exists():
            shutil.rmtree(output_path)
            logger.info(f"Cleaned {output_path}")

        inventory = BaseInventoryManager(registry_dir)
        versions = inventory.list_release_versions()

        if not versions:
            logger.error("No release versions found in configuration registry")
            return 1

        logger.info(f"Processing {len(versions)} configuration schema versions")

        versions_dir = output_path / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)

        for version in versions:
            logger.info(f"Processing configuration schema version: {version}")
            version_dir = inventory.get_version_dir(version)
            registry = _load_yaml_registry(version_dir)
            resolver = SchemaResolver(registry)
            resolved = resolver.resolve(ROOT_SCHEMA_FILE)
            ui_tree = map_schema_to_ui_tree(resolved)

            version_file = versions_dir / f"{version}.json"
            content = json.dumps(ui_tree, indent=2, sort_keys=True)
            version_file.write_text(content, encoding="utf-8")
            logger.info(f"Wrote {version_file}")

        version_list = [{"version": str(v), "is_latest": v == versions[0]} for v in versions]
        index_file = output_path / "versions-index.json"
        index_content = json.dumps({"versions": version_list}, indent=2, sort_keys=True)
        index_file.write_text(index_content, encoding="utf-8")
        logger.info(f"Wrote {index_file}")

        logger.info("Configuration schema build completed successfully")
        return 0

    except Exception as e:
        logger.error(f"Configuration build failed: {e}", exc_info=True)
        return 1
