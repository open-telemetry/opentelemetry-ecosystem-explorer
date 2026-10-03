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
"""The committed manifest that pins which published archive a commit was built from.

Each ecosystem owns a self-contained block. The blocks are physically separated so git merges two
per-ecosystem promotions three-way and order-independently; a shared top-level block would have
every data pull request rewriting the same lines, and a stale merge would silently revert another
ecosystem's data while showing only a changed hex string.

The workflow calls this module directly after publishing a release, because archive_sha256 has to be
the published asset's digest rather than the bytes this run happened to build.
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path

from explorer_db_builder.ecosystems import ECOSYSTEMS

logger = logging.getLogger(__name__)

# Netlify sets base = "ecosystem-explorer" with no ignore command, so a manifest at the repository
# root would make the promotion merge build nothing at all, with a green check.
MANIFEST_PATH = Path("ecosystem-explorer/public/data-manifest.json")

SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
COMMIT_SHA = re.compile(r"^[0-9a-f]{7,40}$")


def asset_name(ecosystem: str) -> str:
    """Name the release asset that carries an ecosystem's archive."""
    return f"{ecosystem}.tar.gz"


def read_manifest(path: Path = MANIFEST_PATH) -> dict:
    """Load the manifest, tolerating the bootstrap run where it does not exist yet.

    Args:
        path: Manifest location.

    Returns:
        The parsed manifest, with an "ecosystems" object guaranteed present.

    Raises:
        ValueError: If the file is not valid JSON or does not hold an object.
    """
    if not path.is_file():
        return {"ecosystems": {}}
    body = path.read_text().strip()
    if not body:
        return {"ecosystems": {}}
    try:
        manifest = json.loads(body)
    except json.JSONDecodeError as error:
        raise ValueError(f"{path} is not valid JSON: {error}") from error
    if not isinstance(manifest, dict):
        raise ValueError(f"{path} must contain a JSON object, found {type(manifest).__name__}")
    ecosystems = manifest.get("ecosystems")
    if ecosystems is None:
        manifest["ecosystems"] = {}
    elif not isinstance(ecosystems, dict):
        raise ValueError(f"{path}: 'ecosystems' must be an object, found {type(ecosystems).__name__}")
    return manifest


def committed_digest(manifest: dict, ecosystem: str) -> str | None:
    """Return the tree digest the manifest currently pins for an ecosystem, if any."""
    block = (manifest.get("ecosystems") or {}).get(ecosystem)
    return block.get("content_digest") if isinstance(block, dict) else None


def update_entry(
    manifest: dict,
    ecosystem: str,
    release_tag: str,
    content_digest: str,
    archive_sha256: str,
    registry_commit: str,
) -> dict:
    """Replace one ecosystem's block, leaving every other key in the document untouched.

    Args:
        manifest: The manifest to update, as returned by read_manifest.
        ecosystem: Which block to rewrite.
        release_tag: Tag of the release holding the asset.
        content_digest: Digest of the unpacked tree.
        archive_sha256: sha256 of the published asset's bytes, as 64 hex characters.
        registry_commit: Checkout SHA the archive was built from. It pins the builder code as well
            as the registry data, which is what the reproducibility claim needs.

    Returns:
        The same manifest object, mutated.

    Raises:
        ValueError: If either digest is not 64 lowercase hex characters, the release tag is empty,
            or the registry commit is not 7 to 40 hex characters. A nullable API field must never
            reach the committed file as the string "null".
    """
    for label, value in (("content_digest", content_digest), ("archive_sha256", archive_sha256)):
        if not SHA256_HEX.match(value):
            raise ValueError(f"{label} must be 64 hex characters, got {value!r}")
    if not release_tag or not release_tag.strip():
        raise ValueError("release_tag must not be empty")
    if not COMMIT_SHA.match(registry_commit):
        raise ValueError(f"registry_commit must be 7 to 40 hex characters, got {registry_commit!r}")
    manifest.setdefault("ecosystems", {})[ecosystem] = {
        "release_tag": release_tag,
        "asset": asset_name(ecosystem),
        "content_digest": content_digest,
        "archive_sha256": archive_sha256,
        "registry_commit": registry_commit,
    }
    return manifest


def write_manifest(path: Path, manifest: dict) -> None:
    """Write the manifest exactly as prettier would.

    `.prettierignore` excludes the `public/data` directory, which does not match
    `public/data-manifest.json`, so anything else fails format:check on every data pull request.

    Args:
        path: Manifest location. Parent directories are created.
        manifest: Document to serialize.
    """
    ordered = dict(manifest)
    ecosystems = manifest.get("ecosystems", {})
    ordered["ecosystems"] = {name: ecosystems[name] for name in sorted(ecosystems)}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ordered, indent=2) + "\n")


def main(argv: list[str] | None = None) -> int:
    """Update a single ecosystem block. Called by the nightly after a release is published."""
    parser = argparse.ArgumentParser(description="Update one ecosystem block in data-manifest.json")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--ecosystem", required=True)
    parser.add_argument("--release-tag", required=True)
    parser.add_argument("--content-digest", required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--registry-commit", required=True)
    args = parser.parse_args(argv)

    if args.ecosystem not in ECOSYSTEMS:
        logger.error(f"❌ Unknown ecosystem {args.ecosystem!r}; expected one of {', '.join(ECOSYSTEMS)}")
        return 1

    path = Path(args.manifest)
    try:
        manifest = update_entry(
            read_manifest(path),
            ecosystem=args.ecosystem,
            release_tag=args.release_tag,
            content_digest=args.content_digest,
            archive_sha256=args.archive_sha256,
            registry_commit=args.registry_commit,
        )
        write_manifest(path, manifest)
    except (ValueError, OSError) as error:
        logger.error(f"❌ {error}")
        return 1

    logger.info(f"Updated {args.ecosystem} in {path}")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(main())
