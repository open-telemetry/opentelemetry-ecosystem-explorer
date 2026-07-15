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
"""Audit collector components for a missing display_name, for the nightly tracking issue.

The report is a build artifact, deliberately NOT written to the content-addressed database,
so it stays out of the DB diff, the DB_VERSION bump, and the automated database PR.
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Experimental interface placeholders in collector-core (the "x" prefix denotes the
# experimental component API), not real user-facing components - they legitimately have
# no display_name, so exclude them from the audit rather than flag them for an upstream fix.
IGNORED_COMPONENT_IDS = frozenset(
    {
        "core-xconnector",
        "core-xexporter",
        "core-xextension",
        "core-xprocessor",
        "core-xreceiver",
    }
)


def find_missing_display_names(components: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Return the components whose display_name is missing or blank.

    Args:
        components: Flat list of canonical component dicts (the shape produced by
            transform_collector_components).

    Returns:
        Slim dicts {id, distribution, type, name} for every component whose display_name
        is absent, null, or empty/whitespace-only, sorted by id for deterministic output.
        Components in IGNORED_COMPONENT_IDS are excluded.
    """
    missing: list[dict[str, str]] = []
    for component in components:
        if component.get("id") in IGNORED_COMPONENT_IDS:
            continue
        if not (component.get("display_name") or "").strip():
            missing.append(
                {
                    "id": component["id"],
                    "distribution": component["distribution"],
                    "type": component["type"],
                    "name": component["name"],
                }
            )
    return sorted(missing, key=lambda c: c["id"])


def write_missing_display_name_report(path: str, version: str, missing: list[dict[str, str]]) -> None:
    """Write the missing-display_name audit report as JSON.

    Args:
        path: Destination file path (a build artifact location, not the database dir).
        version: The collector release version the report reflects (latest processed).
        missing: Output of find_missing_display_names.
    """
    report = {
        "ecosystem": "collector",
        "version": version,
        "missing": missing,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    logger.info("Wrote missing-display_name report to %s", path)
