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
from pathlib import Path

import yaml
from watcher_common.content_hashing import compute_content_hash

logger = logging.getLogger(__name__)

SCHEMA_RELATIVE_PATH = "cmd/mdatagen/metadata-schema.yaml"

UNKNOWN_HASH = "unknown"


class CollectorSchemaCopier:
    """Stores metadata-schema.yaml content into content-addressable storage.

    The hash is computed from the *normalized* YAML representation of the schema
    (``yaml.safe_load`` then ``yaml.safe_dump`` with stable options), so
    comment-only, formatting, and key-order changes upstream do not churn the
    store. The stored file keeps the original content verbatim — only the file
    *name* is derived from the normalized hash.

    Callers pass the schema *content* (read from a pinned git ref via
    ``VersionDetector.read_file_at_ref``) rather than a working-tree path, so the
    hash is a pure function of the content and never depends on which revision a
    clone happens to be checked out to.
    """

    def store_schema_content(self, content: str | None, schemas_dir: Path) -> str | None:
        """
        Store schema content into a hash-named file under ``schemas_dir``.

        The destination is ``schemas_dir / f"{schema_hash}.yaml"``. If a file
        with that name already exists (the same schema content was stored
        previously, possibly by another version or distribution), the write is
        skipped — the existing file is the canonical record.

        Args:
            content: Raw ``metadata-schema.yaml`` text, or None when the schema
                file is absent at the requested ref (older tags pre-date it).
            schemas_dir: Content-addressable storage directory (typically
                ``ecosystem-registry/collector/meta/schemas``).

        Returns:
            The 12-char schema hash on success, or None when ``content`` is None.
        """
        if content is None:
            return None

        schema_hash = self.compute_schema_hash(content)
        dst = schemas_dir / f"{schema_hash}.yaml"
        if dst.exists():
            logger.debug("Schema %s already stored at %s, skipping write", schema_hash, dst)
            return schema_hash

        schemas_dir.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        logger.debug("Stored schema %s at %s", schema_hash, dst)
        return schema_hash

    def compute_schema_hash(self, content: str | None) -> str:
        """
        Compute the content hash of schema content, ignoring comments and key order.

        The hash is taken over the normalized YAML representation, so two schemas
        that differ only in comments, formatting, or key order hash identically.

        Returns ``UNKNOWN_HASH`` when ``content`` is None — used by component
        YAMLs scanned from older collector tags that pre-date the schema file.

        Args:
            content: Raw schema text, or None.

        Returns:
            12-character hex hash, or ``UNKNOWN_HASH``.
        """
        if content is None:
            return UNKNOWN_HASH
        return compute_content_hash(self._normalize(content))

    @staticmethod
    def _normalize(content: str) -> str:
        """Return a canonical YAML rendering of ``content``.

        Dump options are pinned (not left to PyYAML defaults) so the canonical
        form — and therefore every schema hash — stays stable across PyYAML
        upgrades. Changing these options re-hashes every schema and requires a
        full backfill to keep the store deduplicated.
        """
        data = yaml.safe_load(content)
        return yaml.safe_dump(
            data,
            sort_keys=True,
            default_flow_style=False,
            allow_unicode=True,
            width=4096,
        )
