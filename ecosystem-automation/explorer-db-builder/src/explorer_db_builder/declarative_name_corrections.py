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
"""Corrects known-bad configuration ``declarative_name`` values from the registry.

Also normalizes the structured peer-service-mapping config: it injects the declarative schema and
forces the system-property ``type`` back to ``map`` (v2.29.0 regressed it to ``structured_list``).

Can be removed after the upstream metadata changes land in a java agent release.
See:
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/18883
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/19077
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

DECLARATIVE_NAME_CORRECTIONS: dict[str, str] = {
    "java.common.peer_service_mapping": "java.common.service_peer_mapping",
}


def apply_declarative_name_corrections(inventory: dict[str, Any]) -> dict[str, Any]:
    """Rewrite known-bad configuration ``declarative_name`` values in place.

    Walks every configuration entry under the inventory's ``libraries`` and ``custom`` lists and
    replaces any ``declarative_name`` found in ``DECLARATIVE_NAME_CORRECTIONS`` with its corrected
    value. The inventory is mutated in place and also returned for convenience.

    Args:
        inventory: Raw inventory data from the registry.

    Returns:
        The same inventory dict, with corrected declarative names.
    """
    if not DECLARATIVE_NAME_CORRECTIONS:
        return inventory

    for key in ("libraries", "custom"):
        for item in inventory.get(key) or []:
            if not isinstance(item, dict):
                continue
            for config in item.get("configurations") or []:
                if not isinstance(config, dict):
                    continue
                original_name = config.get("declarative_name")
                corrected = DECLARATIVE_NAME_CORRECTIONS.get(original_name)

                if corrected is not None:
                    config["declarative_name"] = corrected
                    logger.debug(
                        "Corrected declarative_name %r -> %r for config %r",
                        original_name,
                        corrected,
                        config.get("name"),
                    )

                current_name = config.get("declarative_name")
                # Key off the stable config ``name`` (not declarative_name): the registry shape of
                # peer-service-mapping drifted across releases and converges only here.
                #   <=2.27.0 : declarative_name unset, type=map, no schema
                #   2.28.x   : declarative_name set, type=map, structured schema present
                #   2.29.0   : type regressed to structured_list
                # Forcing the full canonical shape on every version (see upstream PR #19077) removes
                # the spurious cross-version diff: type=map on the system-property/env-var form,
                # declarative_type=structured_list only on the declarative form. This is idempotent
                # once #19077 lands in a release.
                if config.get("name") == "otel.instrumentation.common.peer-service-mapping":
                    config["declarative_name"] = "java.common.service_peer_mapping"
                    config["type"] = "map"
                    config["declarative_type"] = "structured_list"
                    config["declarative_schema"] = {
                        "type": "object",
                        "required": ["peer", "service_name"],
                        "properties": {
                            "peer": {"type": "string", "description": "Host name or IP address to match against."},
                            "service_name": {
                                "type": "string",
                                "description": "Peer service name to record for matching peers.",
                            },
                        },
                    }
                elif current_name and current_name.endswith("url_template_rules"):
                    config["declarative_type"] = "structured_list"
                    config["declarative_schema"] = {
                        "type": "object",
                        "required": ["pattern", "template"],
                        "properties": {
                            "pattern": {
                                "type": "string",
                                "description": "Regular expression matched against the request URL.",
                            },
                            "template": {
                                "type": "string",
                                "description": "Template used to derive the low-cardinality route.",
                            },
                            "override": {
                                "type": "boolean",
                                "default": False,
                                "description": "Whether this rule overrides an already-applied template.",
                            },
                        },
                    }

    return inventory
