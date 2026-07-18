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
"""Tests for readme_scanner."""

from pathlib import Path
from unittest.mock import patch

from collector_watcher.readme_scanner import discover_component_readmes


def write_component(
    repo_path: Path, component_type: str, name: str, subtype: str | None = None, readme: str | None = None
):
    """Create a component directory (optionally nested under a subtype), optionally with a README.md."""
    directory = repo_path / component_type / subtype / name if subtype else repo_path / component_type / name
    directory.mkdir(parents=True)
    if readme is not None:
        (directory / "README.md").write_text(readme, encoding="utf-8")


def test_finds_readme_for_simple_component(tmp_path):
    write_component(tmp_path, "receiver", "otlpreceiver", readme="# OTLP Receiver")
    components = {"receiver": [{"name": "otlpreceiver"}]}

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {"otlpreceiver": "# OTLP Receiver"}


def test_finds_readme_for_nested_subtype_component(tmp_path):
    write_component(tmp_path, "extension", "s3storage", subtype="storage", readme="# S3 Storage")
    components = {"extension": [{"name": "s3storage", "subtype": "storage"}]}

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {"s3storage": "# S3 Storage"}


def test_skips_component_without_readme(tmp_path):
    write_component(tmp_path, "receiver", "otlpreceiver")  # no readme=...
    components = {"receiver": [{"name": "otlpreceiver"}]}

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {}


def test_skips_entry_missing_name(tmp_path):
    components = {"receiver": [{"subtype": None}]}  # malformed: no "name" key

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {}


def test_handles_mixed_presence_across_types(tmp_path):
    write_component(tmp_path, "receiver", "otlpreceiver", readme="# OTLP")
    write_component(tmp_path, "processor", "batchprocessor")  # no readme
    write_component(tmp_path, "exporter", "loggingexporter", readme="# Logging")

    components = {
        "receiver": [{"name": "otlpreceiver"}],
        "processor": [{"name": "batchprocessor"}],
        "exporter": [{"name": "loggingexporter"}],
        "connector": [],
    }

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {"otlpreceiver": "# OTLP", "loggingexporter": "# Logging"}


def test_missing_component_directory_is_skipped_not_raised(tmp_path):
    # No directory created at all for this component - scanner data can be
    # stale relative to a fresh checkout; this must not raise.
    components = {"receiver": [{"name": "doesnotexist"}]}

    readmes = discover_component_readmes(str(tmp_path), components)

    assert readmes == {}


def test_unreadable_readme_is_skipped_not_raised(tmp_path):
    write_component(tmp_path, "receiver", "otlpreceiver", readme="# OTLP Receiver")
    components = {"receiver": [{"name": "otlpreceiver"}]}

    with patch.object(Path, "read_text", side_effect=OSError("permission denied")):
        readmes = discover_component_readmes(str(tmp_path), components)

    # The bad file is skipped; the function still returns cleanly with no entry for it.
    assert readmes == {}
