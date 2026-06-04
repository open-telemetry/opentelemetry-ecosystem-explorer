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

Can be removed after the next java agent release.
See https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/18883
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
                current = config.get("declarative_name")
                corrected = DECLARATIVE_NAME_CORRECTIONS.get(current)
                if corrected is not None:
                    config["declarative_name"] = corrected
                    logger.debug(
                        "Corrected declarative_name %r -> %r for config %r",
                        current,
                        corrected,
                        config.get("name"),
                    )

    return inventory
