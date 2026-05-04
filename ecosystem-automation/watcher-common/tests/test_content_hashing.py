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
"""Tests for watcher_common.content_hashing."""

from watcher_common.content_hashing import HASH_LENGTH, compute_content_hash


def test_known_hash_bytes():
    # SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    assert compute_content_hash(b"hello") == "2cf24dba5fb0"


def test_string_and_bytes_equal():
    assert compute_content_hash("hello") == compute_content_hash(b"hello")


def test_utf8_encoding():
    text = "héllo"
    assert compute_content_hash(text) == compute_content_hash(text.encode("utf-8"))


def test_hash_length():
    result = compute_content_hash(b"anything")
    assert len(result) == HASH_LENGTH == 12


def test_different_content_different_hash():
    assert compute_content_hash(b"foo") != compute_content_hash(b"bar")


def test_empty_bytes():
    result = compute_content_hash(b"")
    assert len(result) == 12
    assert result == compute_content_hash("")
