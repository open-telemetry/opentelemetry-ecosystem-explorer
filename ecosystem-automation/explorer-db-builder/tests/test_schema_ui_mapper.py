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
"""Tests for schema UI mapper."""

from explorer_db_builder.schema_ui_mapper import _extract_type_info


class TestExtractTypeInfo:
    def test_nullable_integer(self):
        assert _extract_type_info({"type": ["integer", "null"]}) == ("integer", True)

    def test_nullable_string(self):
        assert _extract_type_info({"type": ["string", "null"]}) == ("string", True)

    def test_nullable_object(self):
        assert _extract_type_info({"type": ["object", "null"]}) == ("object", True)

    def test_plain_string(self):
        assert _extract_type_info({"type": "string"}) == ("string", False)

    def test_plain_object(self):
        assert _extract_type_info({"type": "object"}) == ("object", False)

    def test_single_element_array(self):
        assert _extract_type_info({"type": ["object"]}) == ("object", False)

    def test_no_type(self):
        assert _extract_type_info({}) == (None, False)
