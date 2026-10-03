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
"""Data transformation and envelope generation for conformance reports."""

import copy
from typing import Any

from . import __version__

IMPORTER_SCHEMA_VERSION = "1.0.0"


def build_envelope(
    report_data: dict[str, Any],
    source_repository: str,
    source_revision: str,
    report_path: str,
    content_digest: str,
) -> dict[str, Any]:
    """Construct the Explorer envelope wrapping report provenance and metadata."""
    targets = report_data.get("targets", [])
    languages = sorted({t.get("language") for t in targets if t.get("language")})
    runners = sorted({t.get("runner") for t in targets if t.get("runner")})
    domains_list = sorted({t.get("domain") for t in targets if t.get("domain")})

    repo_url = (
        f"https://github.com/{source_repository}" if not source_repository.startswith("http") else source_repository
    )
    # Strip git suffix if present
    if repo_url.endswith(".git"):
        repo_url = repo_url[:-4]

    report_url = f"{repo_url}/blob/{source_revision}/{report_path}"

    envelope: dict[str, Any] = {
        "schema_version": IMPORTER_SCHEMA_VERSION,
        "upstream_schema_version": report_data.get("schema_version", 1),
        "importer_version": __version__,
        "provenance": {
            "source_repository": repo_url,
            "source_revision": source_revision,
            "report_path": report_path,
            "report_digest": content_digest,
            "report_url": report_url,
        },
        "domains": report_data.get("domains", {}),
        "targets_summary": {
            "total_targets": len(targets),
            "languages": languages,
            "runners": runners,
            "domains": domains_list,
        },
    }
    return envelope


def transform_targets(
    report_data: dict[str, Any],
    source_repository: str,
    source_revision: str,
) -> list[dict[str, Any]]:
    """Transform targets with deterministic ordering and repository context URLs."""
    raw_targets = report_data.get("targets", [])
    repo_url = (
        f"https://github.com/{source_repository}" if not source_repository.startswith("http") else source_repository
    )
    if repo_url.endswith(".git"):
        repo_url = repo_url[:-4]

    # Sort targets deterministically by ID
    sorted_targets = sorted(raw_targets, key=lambda t: t.get("id", ""))

    transformed = []
    for raw_t in sorted_targets:
        t = copy.deepcopy(raw_t)
        target_path = t.get("path")
        if target_path:
            # Clean POSIX forward slashes
            clean_path = target_path.replace("\\", "/").strip("/")
            t["repository_context_urls"] = {
                "conformance_yaml": f"{repo_url}/blob/{source_revision}/{clean_path}/conformance.yaml",
                "data_json": f"{repo_url}/blob/{source_revision}/{clean_path}/data.json",
                "note": (
                    "Target files reflect repository context at snapshot commit "
                    "and do not guarantee exact observation inputs."
                ),
            }
        transformed.append(t)

    return transformed
