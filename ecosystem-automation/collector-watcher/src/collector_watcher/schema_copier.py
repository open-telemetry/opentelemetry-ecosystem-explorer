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
"""Copies and hashes the upstream collector metadata schema file."""

import logging
import shutil
from pathlib import Path

from watcher_common.content_hashing import compute_content_hash

logger = logging.getLogger(__name__)

# Location of the schema file within the upstream opentelemetry-collector repo
SCHEMA_RELATIVE_PATH = "cmd/mdatagen/metadata-schema.yaml"
SCHEMA_FILENAME = "metadata-schema.yaml"

# Sentinel returned when the schema file is absent (older tags pre-date the file)
UNKNOWN_HASH = "unknown"


class CollectorSchemaCopier:
    """Copies and hashes metadata-schema.yaml from a collector repo checkout."""

    def copy_schema(self, repo_path: Path, target_dir: Path) -> str | None:
        """
        Copy metadata-schema.yaml from the upstream repository to target_dir.

        Args:
            repo_path: Path to the checked-out collector repository.
            target_dir: Directory to copy the schema file into.

        Returns:
            The destination filename on success, None if the schema file is
            absent in the repository (graceful degradation for older tags).
        """
        src = repo_path / SCHEMA_RELATIVE_PATH
        if not src.exists():
            logger.debug("Schema file not found in repo at %s, skipping copy", src)
            return None

        target_dir.mkdir(parents=True, exist_ok=True)
        dst = target_dir / SCHEMA_FILENAME
        shutil.copy2(src, dst)
        logger.debug("Copied schema to %s", dst)
        return SCHEMA_FILENAME

    def compute_schema_hash(self, schema_path: Path) -> str:
        """
        Compute a stable content hash of the schema file.

        Uses SHA-256 of the raw file bytes, truncated to 12 hex characters.
        Returns the sentinel UNKNOWN_HASH if the file does not exist, so
        registry files written against older tags that lack the schema file
        carry an explicit marker rather than a missing field.

        Args:
            schema_path: Path to the schema file.

        Returns:
            12-character hex hash string, or UNKNOWN_HASH.
        """
        if not schema_path.exists():
            return UNKNOWN_HASH
        return compute_content_hash(schema_path.read_bytes())
