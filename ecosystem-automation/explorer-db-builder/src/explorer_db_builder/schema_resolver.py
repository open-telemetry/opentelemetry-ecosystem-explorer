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
"""Resolves $ref references across YAML schema files."""

import copy
from typing import Any


class SchemaResolver:
    """Resolves $ref references in a registry of {filename: parsed_yaml} dicts."""

    def __init__(self, registry: dict[str, Any]) -> None:
        self._registry = registry
        self._resolution_stack: list[str] = []

    def resolve(self, entry_file: str) -> dict[str, Any]:
        """Resolve all $refs starting from entry_file. Returns fully inlined schema with $defs stripped."""
        return self._resolve_node(self._registry[entry_file], entry_file)

    def _resolve_node(self, node: Any, current_file: str) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return self._resolve_ref(node, current_file)
            return {k: self._resolve_node(v, current_file) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [self._resolve_node(item, current_file) for item in node]
        return node

    def _resolve_ref(self, node: dict[str, Any], current_file: str) -> Any:
        """Resolve a $ref node. Siblings override resolved ref properties."""
        ref_value = node["$ref"]
        siblings = {k: self._resolve_node(v, current_file) for k, v in node.items() if k != "$ref"}

        stack_key = f"{current_file}{ref_value}" if ref_value.startswith("#/") else ref_value

        if stack_key in self._resolution_stack:
            marker = {"$circular_ref": ref_value}
            if siblings:
                marker.update(siblings)
            return marker

        self._resolution_stack.append(stack_key)
        try:
            resolved = self._lookup_ref(ref_value, current_file)

            if isinstance(resolved, dict):
                resolved = self._resolve_node(resolved, self._ref_file(ref_value, current_file))
                if siblings:
                    return {**resolved, **siblings}
                return resolved
            return resolved
        finally:
            self._resolution_stack.pop()

    def _lookup_ref(self, ref: str, current_file: str) -> Any:
        if ref.startswith("#/"):
            path_parts = ref[2:].split("/")
            target = self._registry[current_file]
            for part in path_parts:
                target = target[part]
            return copy.deepcopy(target)

        if "#" in ref:
            file_name, fragment = ref.split("#", 1)
            target = self._registry[file_name]
            path_parts = fragment.lstrip("/").split("/")
            for part in path_parts:
                target = target[part]
            return copy.deepcopy(target)

        return copy.deepcopy(self._registry[ref])

    def _ref_file(self, ref: str, current_file: str) -> str:
        if ref.startswith("#/"):
            return current_file
        if "#" in ref:
            return ref.split("#")[0]
        return ref
