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


CONSTRAINT_KEYS = ("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems")
PASSTHROUGH_KEYS = ("description", "defaultBehavior", "nullBehavior")


def map_schema_to_ui_tree(resolved_schema: dict[str, Any]) -> dict[str, Any]:
    """Transform a resolved JSON Schema into a UI-friendly tree."""
    return _map_node(resolved_schema, key="root", parent_path="", parent_required_keys=set())


def _map_node(
    node: dict[str, Any],
    key: str,
    parent_path: str,
    parent_required_keys: set[str],
) -> dict[str, Any]:
    """Recursively map a schema node to a UI node."""
    control_type = _classify_node(node)
    path = f"{parent_path}.{key}" if parent_path else key
    if key == "root" and parent_path == "":
        path = ""

    effective_type, nullable = _extract_type_info(node)

    result: dict[str, Any] = {
        "controlType": control_type,
        "key": key,
        "path": path,
        "label": _generate_label(key),
    }

    if key in parent_required_keys:
        result["required"] = True

    if nullable:
        result["nullable"] = True

    if key.endswith("/development"):
        result["stability"] = "development"

    for passthrough in PASSTHROUGH_KEYS:
        if passthrough in node:
            result[passthrough] = node[passthrough]

    constraints = {k: node[k] for k in CONSTRAINT_KEYS if k in node}
    if constraints:
        result["constraints"] = constraints

    required_keys = set(node.get("required", []))

    if control_type == "group":
        additional = node.get("additionalProperties")
        if isinstance(additional, dict):
            result["allowAdditional"] = True
        result["children"] = [
            _map_node(prop_schema, prop_key, path, required_keys)
            for prop_key, prop_schema in node.get("properties", {}).items()
        ]

    elif control_type == "plugin_select":
        result["allowCustom"] = bool(node.get("isSdkExtensionPlugin"))
        result["options"] = [
            _map_node(prop_schema, prop_key, path, set())
            for prop_key, prop_schema in node.get("properties", {}).items()
        ]

    elif control_type == "select":
        enum_descs = node.get("enumDescriptions", {})
        result["enumOptions"] = [
            {"value": v, "description": enum_descs.get(v, "")} for v in node.get("enum", []) if v is not None
        ]

    elif control_type == "list":
        items = node.get("items", {})
        if isinstance(items, dict):
            result["itemSchema"] = _map_node(items, "item", path, set())

    elif control_type == "circular_ref":
        ref_value = node.get("$circular_ref", "")
        ref_parts = ref_value.rsplit("/", 1)
        result["refType"] = ref_parts[-1] if ref_parts else ref_value

    elif control_type == "union":
        result["variants"] = [
            _map_node(variant, f"variant_{i}", path, set()) for i, variant in enumerate(node.get("oneOf", []))
        ]

    return result
