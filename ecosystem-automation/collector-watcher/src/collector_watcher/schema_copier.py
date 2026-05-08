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
"""Stores the upstream collector metadata schema in content-addressable storage.

The schema is stored once per distinct content under
``meta/schemas/{hash}.yaml`` rather than once per release. This means a schema
that is unchanged across many collector releases occupies a single file, and
``schema_hash`` recorded on a component YAML directly identifies the file
holding that schema (no version directory lookup required).
"""

import logging
import shutil
from pathlib import Path

from watcher_common.content_hashing import compute_content_hash

logger = logging.getLogger(__name__)

SCHEMA_RELATIVE_PATH = "cmd/mdatagen/metadata-schema.yaml"

UNKNOWN_HASH = "unknown"


class CollectorSchemaCopier:
    """Stores metadata-schema.yaml from a collector repo into content-addressable storage."""

    def store_schema(self, repo_path: Path, schemas_dir: Path) -> str | None:
        """
        Copy metadata-schema.yaml from the upstream repo into a hash-named file.

        The destination is ``schemas_dir / f"{schema_hash}.yaml"``. If a file
        with that name already exists (because the same schema content was
        stored previously), the copy is skipped — the existing file is the
        canonical record. Returns the schema hash on success.

        Args:
            repo_path: Path to the checked-out collector repository.
            schemas_dir: Content-addressable storage directory (typically
                ``ecosystem-registry/collector/meta/schemas``).

        Returns:
            The 12-char schema hash on success, or None if the upstream repo
            does not contain ``cmd/mdatagen/metadata-schema.yaml`` (older tags
            pre-date the file).
        """
        src = repo_path / SCHEMA_RELATIVE_PATH
        if not src.exists():
            logger.debug("Schema file not found in repo at %s, skipping store", src)
            return None

        schema_hash = compute_content_hash(src.read_bytes())
        dst = schemas_dir / f"{schema_hash}.yaml"
        if dst.exists():
            logger.debug("Schema %s already stored at %s, skipping copy", schema_hash, dst)
            return schema_hash

        schemas_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        logger.debug("Stored schema %s at %s", schema_hash, dst)
        return schema_hash

    def compute_schema_hash(self, schema_path: Path) -> str:
        """
        Compute the content hash of a schema file.

        Returns ``UNKNOWN_HASH`` when the file is absent — used by component
        YAMLs scanned from older collector tags that pre-date the schema file.

        Args:
            schema_path: Path to the schema file.

        Returns:
            12-character hex hash, or ``UNKNOWN_HASH``.
        """
        if not schema_path.exists():
            return UNKNOWN_HASH
        return compute_content_hash(schema_path.read_bytes())
