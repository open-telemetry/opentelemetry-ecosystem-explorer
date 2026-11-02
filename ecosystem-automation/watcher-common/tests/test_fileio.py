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

"""Tests for atomic file publication."""

from unittest.mock import patch

import pytest
from watcher_common.fileio import atomic_write


def test_atomic_write_creates_parents_and_leaves_no_temp(tmp_path):
    path = tmp_path / "a" / "b" / "file.yaml"
    atomic_write(path, b"one")
    atomic_write(path, b"two")
    assert path.read_bytes() == b"two"
    assert list(path.parent.iterdir()) == [path]


def test_atomic_write_failure_keeps_previous_content(tmp_path):
    path = tmp_path / "file.yaml"
    path.write_bytes(b"previous")
    with patch("watcher_common.fileio.os.replace", side_effect=OSError("disk full")), pytest.raises(OSError):
        atomic_write(path, b"new")
    assert path.read_bytes() == b"previous"
    assert list(tmp_path.iterdir()) == [path]
