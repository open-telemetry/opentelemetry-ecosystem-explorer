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
