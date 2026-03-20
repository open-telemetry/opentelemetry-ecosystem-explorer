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
"""Copies schema YAML files from a repository checkout."""

import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

SCHEMA_DIR = "schema"


class SchemaCopier:
    """Copies schema YAML files from a repository checkout."""

    def copy_schemas(self, repo_path: Path, target_dir: Path) -> list[str]:
        """
        Copy all .yaml files from repo_path/schema/ to target_dir.

        Args:
            repo_path: Path to the checked-out repository
            target_dir: Directory to copy schema files into

        Returns:
            Sorted list of copied filenames

        Raises:
            FileNotFoundError: If schema/ directory doesn't exist in the repo
        """
        schema_dir = repo_path / SCHEMA_DIR

        if not schema_dir.exists():
            raise FileNotFoundError(f"Schema directory not found: {schema_dir}")

        yaml_files = sorted(schema_dir.glob("*.yaml"))

        if not yaml_files:
            return []

        target_dir.mkdir(parents=True, exist_ok=True)

        copied = []
        for src_file in yaml_files:
            shutil.copy2(src_file, target_dir / src_file.name)
            copied.append(src_file.name)

        logger.info("Copied %d schema files to %s", len(copied), target_dir)
        return copied
