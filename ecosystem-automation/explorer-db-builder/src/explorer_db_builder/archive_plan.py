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
"""Turn a finished build into archives plus the plan the nightly workflow acts on.

This is the facade over the three leaves: ecosystems knows the topology, archive_writer knows bytes,
data_manifest knows the committed file. main.py orchestrates the builders the same way.
"""

import json
import logging
from pathlib import Path

from explorer_db_builder.archive_writer import pack, relative_files, release_tag, tree_digest
from explorer_db_builder.data_manifest import MANIFEST_PATH, asset_name, committed_digest, read_manifest
from explorer_db_builder.ecosystems import DATA_ROOT, ECOSYSTEMS

logger = logging.getLogger(__name__)

PLAN_FILENAME = "archive-plan.json"


def emit_archives(
    output_dir: Path,
    data_root: Path = DATA_ROOT,
    manifest_path: Path = MANIFEST_PATH,
) -> int:
    """Pack every ecosystem and describe what the workflow should publish.

    Args:
        output_dir: Directory to write the archives and archive-plan.json into.
        data_root: Directory holding the three generated ecosystem directories.
        manifest_path: Committed manifest, read to decide which ecosystems changed.

    Returns:
        0 on success, 1 if any ecosystem directory is missing.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    # Remove any plan left by an earlier run before validating, so every failure path below leaves
    # the directory without a plan rather than with a stale one a later step could act on.
    (output_dir / PLAN_FILENAME).unlink(missing_ok=True)

    missing = [name for name in ECOSYSTEMS if not (data_root / name).is_dir()]
    if missing:
        logger.error(
            f"❌ Cannot archive {', '.join(missing)}: no such directory under {data_root}. "
            "The builder must run from the repository root."
        )
        return 1

    # An empty directory packs into a valid 45-byte archive under a legitimate-looking tag, and
    # promoting it would replace the live data with nothing. A pipeline that produced no files is a
    # build failure, not a publishable state.
    # Counted through relative_files, not rglob, so the guard and the packer agree on what a file
    # is. A directory holding only symlinks otherwise passed here and packed into an empty archive.
    empty = [name for name in ECOSYSTEMS if not relative_files(data_root / name)]
    if empty:
        logger.error(f"❌ Refusing to archive {', '.join(empty)}: the build produced no files")
        return 1

    try:
        manifest = read_manifest(manifest_path)
        plan: dict[str, dict] = {}

        for ecosystem in ECOSYSTEMS:
            directory = data_root / ecosystem
            digest = tree_digest(directory)
            pack(directory, output_dir / asset_name(ecosystem))
            changed = committed_digest(manifest, ecosystem) != digest
            plan[ecosystem] = {
                "content_digest": digest,
                "release_tag": release_tag(ecosystem, digest),
                "asset": asset_name(ecosystem),
                "changed": changed,
            }
            logger.info(f"  {ecosystem}: {digest[:12]} ({'changed' if changed else 'unchanged'})")
    except (ValueError, OSError) as error:
        logger.error(f"❌ {error}")
        return 1

    (output_dir / PLAN_FILENAME).write_text(json.dumps(plan, indent=2, sort_keys=True) + "\n")
    return 0
