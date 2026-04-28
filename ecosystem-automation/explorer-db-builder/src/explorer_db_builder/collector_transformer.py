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
"""Transforms collector component data from registry format to explorer format."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def transform_collector_data(inventory_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Transform collector inventory data to explorer component format.

    Flattens the nested component structure and adds context like distribution
     and component type to each component.

    Args:
        inventory_data: Raw inventory data from registry

    Returns:
        List of transformed components ready for the explorer
    """
    distribution = inventory_data.get("distribution")
    version = inventory_data.get("version")
    repository = inventory_data.get("repository")
    components_by_type = inventory_data.get("components", {})

    transformed_components = []

    for component_type, components in components_by_type.items():
        for component in components:
            metadata = component.get("metadata", {})
            transformed = {
                "name": component.get("name"),
                "component_type": component_type,
                "distribution": distribution,
                "version": version,
                "repository": repository,
                **metadata,
            }

            transformed_components.append(transformed)

    logger.info(
        f"Transformed {len(transformed_components)} collector components for distribution {distribution} v{version}"
    )
    return transformed_components
