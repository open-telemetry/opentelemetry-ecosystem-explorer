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
"""Tests for transformer and envelope builder."""

from conformance_watcher.transformer import build_envelope, transform_targets


def test_build_envelope() -> None:
    report_data = {
        "schema_version": 1,
        "domains": {"http-conformance": {"registry_dir": "model"}},
        "targets": [
            {
                "id": "t1",
                "language": "python",
                "runner": "http-conformance",
                "domain": "http",
            },
            {
                "id": "t2",
                "language": "go",
                "runner": "http-conformance",
                "domain": "http",
            },
        ],
    }

    envelope = build_envelope(
        report_data=report_data,
        source_repository="open-telemetry/semantic-conventions-conformance",
        source_revision="6f85d0aa70eb55116d161c5c0737a6ba55faf101",
        report_path="docs/data/conformance.json",
        content_digest="sha256:abcd1234abcd",
    )

    assert envelope["schema_version"] == "1.0.0"
    assert envelope["upstream_schema_version"] == 1
    assert envelope["provenance"]["source_revision"] == "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
    assert envelope["provenance"]["report_digest"] == "sha256:abcd1234abcd"
    assert envelope["targets_summary"]["total_targets"] == 2
    assert envelope["targets_summary"]["languages"] == ["go", "python"]
    assert envelope["targets_summary"]["runners"] == ["http-conformance"]


def test_transform_targets_deterministic_ordering_and_context_urls() -> None:
    report_data = {
        "targets": [
            {"id": "b-target", "path": "scenarios/b"},
            {"id": "a-target", "path": "scenarios/a"},
        ]
    }

    transformed = transform_targets(
        report_data=report_data,
        source_repository="open-telemetry/semantic-conventions-conformance",
        source_revision="6f85d0aa70eb55116d161c5c0737a6ba55faf101",
    )

    # Must be sorted by ID
    assert [t["id"] for t in transformed] == ["a-target", "b-target"]

    first = transformed[0]
    assert "repository_context_urls" in first
    assert (
        first["repository_context_urls"]["conformance_yaml"]
        == "https://github.com/open-telemetry/semantic-conventions-conformance/blob/6f85d0aa70eb55116d161c5c0737a6ba55faf101/scenarios/a/conformance.yaml"
    )
    assert (
        first["repository_context_urls"]["data_json"]
        == "https://github.com/open-telemetry/semantic-conventions-conformance/blob/6f85d0aa70eb55116d161c5c0737a6ba55faf101/scenarios/a/data.json"
    )
