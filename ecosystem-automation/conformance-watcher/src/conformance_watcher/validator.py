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
"""Validation logic for conformance reports."""

import os
from typing import Any

SUPPORTED_SCHEMA_VERSIONS = {1}


def is_safe_repository_path(path: str) -> bool:
    """Validate that path is a relative path strictly within repository boundaries."""
    if not path or not isinstance(path, str):
        return False
    # Reject absolute paths (POSIX / Windows drive letters / UNC)
    if os.path.isabs(path) or path.startswith(("/", "\\")) or (len(path) > 1 and path[1] == ":"):
        return False
    # Normalize and ensure no parent directory escapes
    normalized = os.path.normpath(path)
    parts = normalized.split(os.sep)
    if any(part == ".." for part in parts) or normalized.startswith(".."):
        return False
    return True


def validate_report(report_data: dict[str, Any]) -> None:
    """Validate conformance report structure, schema version, target IDs, runners, and paths.

    Raises:
        ValueError: If validation fails.
    """
    if not isinstance(report_data, dict):
        raise ValueError("Report root must be a JSON object")

    schema_version = report_data.get("schema_version")
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        raise ValueError(
            f"Unsupported schema version: {schema_version}. Supported versions: {sorted(SUPPORTED_SCHEMA_VERSIONS)}"
        )

    domains = report_data.get("domains")
    if not isinstance(domains, dict):
        raise ValueError("Report must contain a 'domains' mapping")

    registry = report_data.get("registry")
    if not isinstance(registry, dict):
        raise ValueError("Report must contain a 'registry' mapping")

    targets = report_data.get("targets")
    if not isinstance(targets, list):
        raise ValueError("Report must contain a 'targets' list")

    seen_target_ids: set[str] = set()

    for idx, target in enumerate(targets):
        if not isinstance(target, dict):
            raise ValueError(f"Target at index {idx} is not an object")

        target_id = target.get("id")
        if not target_id or not isinstance(target_id, str):
            raise ValueError(f"Target at index {idx} has invalid or missing 'id'")

        if target_id in seen_target_ids:
            raise ValueError(f"Duplicate target ID found: '{target_id}'")
        seen_target_ids.add(target_id)

        runner = target.get("runner")
        if not runner or not isinstance(runner, str):
            raise ValueError(f"Target '{target_id}' has missing or non-string 'runner'")

        if runner not in domains:
            raise ValueError(f"Target '{target_id}' references runner '{runner}' not declared in 'domains'")

        if runner not in registry:
            raise ValueError(f"Target '{target_id}' references runner '{runner}' not declared in 'registry'")

        path = target.get("path")
        if path is not None:
            if not is_safe_repository_path(path):
                raise ValueError(f"Target '{target_id}' has unsafe path '{path}' escaping repository boundary")
