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
"""Transforms resolved JSON Schema into a UI-friendly tree."""

from typing import Any


def _extract_type_info(node: dict[str, Any]) -> tuple[str | None, bool]:
    """Extract effective type and nullable flag from a schema node."""
    type_val = node.get("type")
    if type_val is None:
        return None, False
    if isinstance(type_val, list):
        non_null = [t for t in type_val if t != "null"]
        nullable = "null" in type_val
        return non_null[0] if non_null else None, nullable
    return type_val, False


def _generate_label(key: str) -> str:
    """Convert a schema key to a human-readable label."""
    base = key.removesuffix("/development")
    return base.replace("_", " ").replace("/", " ").strip().title()


def _classify_node(node: dict[str, Any]) -> str:
    """Classify a schema node into a UI control type."""
    if "$circular_ref" in node:
        return "circular_ref"

    if "oneOf" in node:
        return "union"

    if node.get("isSdkExtensionPlugin"):
        return "plugin_select"

    if node.get("minProperties") == 1 and node.get("maxProperties") == 1 and node.get("properties"):
        return "plugin_select"

    if "enum" in node:
        return "select"

    effective_type, nullable = _extract_type_info(node)

    if effective_type == "array":
        items = node.get("items", {})
        items_type, _ = _extract_type_info(items) if isinstance(items, dict) else (None, False)
        if items_type == "string":
            return "string_list"
        if items_type in ("number", "integer"):
            return "number_list"
        return "list"

    if effective_type == "object":
        has_properties = bool(node.get("properties"))
        additional = node.get("additionalProperties")

        if not has_properties and isinstance(additional, dict):
            return "key_value_map"

        if has_properties:
            return "group"

        if additional is False:
            return "flag"

        return "group"

    if effective_type == "boolean":
        return "toggle"

    if effective_type in ("integer", "number"):
        return "number_input"

    if effective_type == "string":
        return "text_input"

    return "group"
