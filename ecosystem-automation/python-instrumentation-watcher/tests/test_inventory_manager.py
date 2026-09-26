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

"""Tests for InventoryManager."""

from unittest.mock import patch

import pytest
import yaml
from python_instrumentation_watcher.inventory_manager import InventoryManager


def test_save_and_version_exists(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {"name": "opentelemetry-instrumentation-flask", "version": "0.48b0"}

    assert not manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    assert manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")


def test_save_writes_valid_yaml(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {
        "name": "opentelemetry-instrumentation-flask",
        "version": "0.48b0",
        "instruments": [{"library": "flask", "version_range": ">=1.0", "source_key": "instruments"}],
    }

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    path = tmp_path / "opentelemetry-instrumentation-flask" / "v0.48b0.yaml"
    assert path.exists()

    loaded = yaml.safe_load(path.read_text())
    assert loaded["name"] == "opentelemetry-instrumentation-flask"
    assert loaded["instruments"][0]["library"] == "flask"


def test_version_path_format(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    manager.save("opentelemetry-instrumentation-requests", "0.48b0", {"name": "test"})

    expected = tmp_path / "opentelemetry-instrumentation-requests" / "v0.48b0.yaml"
    assert expected.exists()


def test_save_does_not_leave_a_temp_file_behind_on_success(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", {"name": "test"})

    package_dir = tmp_path / "opentelemetry-instrumentation-flask"
    # Exactly the final file — no leftover temp file from the atomic-write step.
    assert [p.name for p in package_dir.iterdir()] == ["v0.48b0.yaml"]


def test_save_failure_during_serialization_does_not_leave_a_partial_final_file(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    final_path = tmp_path / "opentelemetry-instrumentation-flask" / "v0.48b0.yaml"

    with (
        patch("python_instrumentation_watcher.inventory_manager.yaml.safe_dump", side_effect=yaml.YAMLError("boom")),
        pytest.raises(yaml.YAMLError),
    ):
        manager.save("opentelemetry-instrumentation-flask", "0.48b0", {"name": "test"})

    assert not final_path.exists()
    assert not manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")


def test_save_failure_cleans_up_its_temp_file(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))

    with (
        patch("python_instrumentation_watcher.inventory_manager.yaml.safe_dump", side_effect=yaml.YAMLError("boom")),
        pytest.raises(yaml.YAMLError),
    ):
        manager.save("opentelemetry-instrumentation-flask", "0.48b0", {"name": "test"})

    package_dir = tmp_path / "opentelemetry-instrumentation-flask"
    # The directory itself is created (mkdir happens before the write attempt), but no
    # stray temp file should remain inside it after cleanup.
    assert list(package_dir.iterdir()) == []


def test_save_retries_successfully_after_a_failed_write(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    data = {"name": "opentelemetry-instrumentation-flask", "version": "0.48b0"}

    with (
        patch("python_instrumentation_watcher.inventory_manager.yaml.safe_dump", side_effect=yaml.YAMLError("boom")),
        pytest.raises(yaml.YAMLError),
    ):
        manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    # A prior failed write must not be mistaken for an already-tracked version.
    assert not manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")

    manager.save("opentelemetry-instrumentation-flask", "0.48b0", data)

    assert manager.version_exists("opentelemetry-instrumentation-flask", "0.48b0")
    path = tmp_path / "opentelemetry-instrumentation-flask" / "v0.48b0.yaml"
    assert yaml.safe_load(path.read_text())["name"] == "opentelemetry-instrumentation-flask"


def test_save_replaces_final_path_from_a_temp_file_in_the_same_directory(tmp_path):
    manager = InventoryManager(registry_dir=str(tmp_path))
    final_path = tmp_path / "opentelemetry-instrumentation-flask" / "v0.48b0.yaml"

    with patch("python_instrumentation_watcher.inventory_manager.os.replace") as mock_replace:
        manager.save("opentelemetry-instrumentation-flask", "0.48b0", {"name": "test"})

    mock_replace.assert_called_once()
    tmp_arg, dest_arg = mock_replace.call_args[0]
    # Same directory as the final path, so the promotion can be atomic (same filesystem).
    assert tmp_arg.parent == final_path.parent
    assert dest_arg == final_path
    # os.replace was mocked out, so the final path was never actually created —
    # confirms the final path only becomes visible via that one replace call, not
    # by writing to it directly beforehand.
    assert not final_path.exists()
