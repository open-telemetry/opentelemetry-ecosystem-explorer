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
"""Tests for conformance report validator."""

import pytest
from conformance_watcher.validator import is_safe_repository_path, validate_report


def test_is_safe_repository_path() -> None:
    assert is_safe_repository_path("scenarios/database/java/mariadb")
    assert is_safe_repository_path("a/b/c.json")
    assert not is_safe_repository_path("../escaped")
    assert not is_safe_repository_path("scenarios/../../escaped")
    assert not is_safe_repository_path("/absolute/path")
    assert not is_safe_repository_path("C:\\windows\\path")
    assert not is_safe_repository_path("")


def test_validate_report_valid() -> None:
    data = {
        "schema_version": 1,
        "domains": {
            "http-conformance": {"registry_dir": "model"},
        },
        "registry": {
            "http-conformance": {"spans": {}},
        },
        "targets": [
            {
                "id": "http/go/net-http",
                "runner": "http-conformance",
                "path": "scenarios/http/go/net-http",
            }
        ],
    }
    # Should not raise
    validate_report(data)


def test_validate_report_unsupported_schema() -> None:
    data = {
        "schema_version": 2,
        "domains": {},
        "registry": {},
        "targets": [],
    }
    with pytest.raises(ValueError, match="Unsupported schema version: 2"):
        validate_report(data)


def test_validate_report_duplicate_target_id() -> None:
    data = {
        "schema_version": 1,
        "domains": {"r1": {}},
        "registry": {"r1": {}},
        "targets": [
            {"id": "target-1", "runner": "r1", "path": "path1"},
            {"id": "target-1", "runner": "r1", "path": "path2"},
        ],
    }
    with pytest.raises(ValueError, match="Duplicate target ID found: 'target-1'"):
        validate_report(data)


def test_validate_report_missing_runner_in_domains() -> None:
    data = {
        "schema_version": 1,
        "domains": {},
        "registry": {"r1": {}},
        "targets": [
            {"id": "target-1", "runner": "r1", "path": "path1"},
        ],
    }
    with pytest.raises(ValueError, match="Target 'target-1' references runner 'r1' not declared in 'domains'"):
        validate_report(data)


def test_validate_report_unsafe_path() -> None:
    data = {
        "schema_version": 1,
        "domains": {"r1": {}},
        "registry": {"r1": {}},
        "targets": [
            {"id": "target-1", "runner": "r1", "path": "../etc/passwd"},
        ],
    }
    with pytest.raises(ValueError, match="has unsafe path"):
        validate_report(data)
