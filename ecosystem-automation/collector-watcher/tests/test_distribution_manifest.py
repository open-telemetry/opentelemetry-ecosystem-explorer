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
"""Tests for releases-repo distribution manifests."""

from unittest.mock import MagicMock

from collector_watcher.distribution_manifest import DistributionManifestSync, parse_manifest
from collector_watcher.inventory_manager import InventoryManager
from semantic_version import Version

MANIFEST = """
dist:
  name: otelcol-test
receivers:
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.162.0
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/receiver/prometheusreceiver v0.162.0
  - gomod: github.com/prometheus/prometheus-opentelemetry-collector/receivers/yace v0.2.0
extensions:
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/extension/storage/filestorage v0.162.0
providers:
  - gomod: go.opentelemetry.io/collector/confmap/provider/envprovider v1.68.0
"""


def test_parse_manifest_resolves_core_contrib_and_nested():
    parsed = parse_manifest(MANIFEST)
    assert parsed["components"] == [
        {"type": "extension", "source": "contrib", "name": "filestorage"},
        {"type": "receiver", "source": "contrib", "name": "prometheusreceiver"},
        {"type": "receiver", "source": "core", "name": "otlpreceiver"},
    ]
    assert parsed["external"] == ["github.com/prometheus/prometheus-opentelemetry-collector/receivers/yace"]


def test_sync_is_idempotent_and_skips_missing_manifests(tmp_path):
    inventory = InventoryManager(str(tmp_path))
    sync = DistributionManifestSync.__new__(DistributionManifestSync)
    sync.inventory_manager = inventory
    sync.detector = MagicMock()
    sync.detector.read_file_at_ref.side_effect = lambda ref, path: MANIFEST if ref == "v0.162.0" else None

    assert sync.sync_version("otlp", Version("0.162.0")) is True
    assert sync.sync_version("otlp", Version("0.162.0")) is False  # already recorded
    assert sync.sync_version("otlp", Version("0.100.0")) is False  # distribution did not exist yet
    assert not inventory.distribution_manifest_exists("otlp", Version("0.100.0"))

    loaded = inventory.load_distribution_manifest("otlp", Version("0.162.0"))
    assert {"type": "receiver", "source": "core", "name": "otlpreceiver"} in loaded
    assert inventory.load_distribution_manifest("otlp", Version("0.100.0")) is None
