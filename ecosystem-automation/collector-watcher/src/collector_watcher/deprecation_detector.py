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
"""Deprecation detection for OpenTelemetry Collector components."""

from typing import Any

from semantic_version import Version

from .type_defs import COMPONENT_TYPES


class DeprecationDetector:
    """Detects deprecated components by comparing version inventories."""

    def detect_deprecated(
        self,
        previous_version: Version | None,
        previous_components: dict[str, list[dict[str, Any]]],
        current_version: Version,
        current_components: dict[str, list[dict[str, Any]]],
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Detect components that were removed between versions.

        Args:
            previous_version: Previous version
            previous_components: Components from previous version
            current_version: Current version
            current_components: Components from current version

        Returns:
            Dictionary mapping component types to lists of deprecated components
        """
        if not previous_version or not previous_components:
            return {component_type: [] for component_type in COMPONENT_TYPES}

        deprecated_components: dict[str, list[dict[str, Any]]] = {}

        for component_type in COMPONENT_TYPES:
            previous_set = self._build_component_set(previous_components.get(component_type, []))
            current_set = self._build_component_set(current_components.get(component_type, []))

            removed_names = previous_set - current_set

            deprecated_list = []
            for component in previous_components.get(component_type, []):
                if component["name"] in removed_names:
                    deprecated_component = self._create_deprecated_component(
                        component, previous_version, current_version
                    )
                    deprecated_list.append(deprecated_component)

            deprecated_components[component_type] = deprecated_list

        return deprecated_components

    @staticmethod
    def _build_component_set(components: list[dict[str, Any]]) -> set[str]:
        """Build a set of component names."""
        return {component["name"] for component in components}

    @staticmethod
    def _create_deprecated_component(
        component: dict[str, Any], last_version: Version, deprecated_in_version: Version
    ) -> dict[str, Any]:
        """Create deprecated component metadata."""
        return {
            "name": component["name"],
            "last_version": f"v{last_version}",
            "deprecated_in_version": f"v{deprecated_in_version}",
            "source_repo": component.get("source_repo"),
            "distributions": component.get("distributions", []),
            "subtype": component.get("subtype"),
        }
