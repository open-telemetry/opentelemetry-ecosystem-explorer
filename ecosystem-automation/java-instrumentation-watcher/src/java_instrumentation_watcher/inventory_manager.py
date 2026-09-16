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
"""Inventory management for Java instrumentation tracking."""

from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version
from watcher_common.content_hashing import compute_content_hash
from watcher_common.inventory_manager import JavaagentInventoryManager


class InventoryManager(JavaagentInventoryManager):
    """Manages Java instrumentation inventory storage and retrieval."""

    JMX_DIR = "jmx"
    JMX_MODELS_INDEX_FILE = "jmx-models.yaml"

    def get_jmx_store_dir(self) -> Path:
        """Return shared content-addressed directory for JMX model YAML files."""
        return self.inventory_dir / self.JMX_DIR

    def jmx_models_index_exists(self, version: Version) -> bool:
        """Return True when a version has a jmx-models.yaml index file."""
        return (self.get_version_dir(version) / self.JMX_MODELS_INDEX_FILE).exists()

    def save_jmx_models_index(
        self,
        version: Version,
        models: dict[str, str],
        manifest: str | None,
    ) -> tuple[dict[str, str], str | None]:
        """Persist shared JMX model files and write per-version index.

        Returns:
            Tuple of (models index map, manifest filename). If nothing was
            persisted, returns ({}, None) and does not write an index file.
        """
        jmx_dir = self.get_jmx_store_dir()

        indexed_models: dict[str, str] = {}
        for target_system in sorted(models):
            indexed_models[target_system] = self._save_jmx_content_addressed_file(
                jmx_dir, target_system, models[target_system]
            )

        manifest_file = None
        if manifest is not None:
            manifest_file = self._save_jmx_content_addressed_file(jmx_dir, "manifest", manifest)

        if not indexed_models and manifest_file is None:
            return {}, None

        payload: dict[str, Any] = {"models": indexed_models}
        if manifest_file is not None:
            payload["manifest"] = manifest_file

        version_dir = self.get_version_dir(version)
        version_dir.mkdir(parents=True, exist_ok=True)
        index_path = version_dir / self.JMX_MODELS_INDEX_FILE
        with open(index_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(payload, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        return indexed_models, manifest_file

    def _save_jmx_content_addressed_file(self, jmx_dir: Path, name: str, content: str) -> str:
        """Save one JMX YAML file content-addressed in shared JMX directory."""
        jmx_dir.mkdir(parents=True, exist_ok=True)
        safe_name = self._sanitize_name(name)
        digest = compute_content_hash(content)
        filename = f"{safe_name}-{digest}.yaml"
        file_path = jmx_dir / filename
        if not file_path.exists():
            file_path.write_text(content, encoding="utf-8")
        return filename
