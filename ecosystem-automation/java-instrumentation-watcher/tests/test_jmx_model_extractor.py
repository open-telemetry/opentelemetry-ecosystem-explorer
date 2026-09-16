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
"""Tests for JmxModelExtractor."""

from unittest.mock import Mock

import pytest
from java_instrumentation_watcher.jmx_model_extractor import JmxModelExtractor


@pytest.fixture
def mock_client():
    return Mock()


@pytest.fixture
def extractor(mock_client):
    return JmxModelExtractor(mock_client)


def test_discover_jmx_model_paths_returns_models_and_manifest(extractor, mock_client):
    mock_client.fetch_tree.return_value = [
        {"type": "blob", "path": "instrumentation/jmx-metrics/model/jvm.yaml"},
        {"type": "blob", "path": "instrumentation/jmx-metrics/model/manifest.yaml"},
        {"type": "blob", "path": "instrumentation/jmx-metrics/model/tomcat.yaml"},
        {"type": "blob", "path": "docs/instrumentation-list.yaml"},
    ]

    models, manifest_path = extractor.discover_jmx_model_paths("abc123")

    assert models == {
        "jvm": "instrumentation/jmx-metrics/model/jvm.yaml",
        "tomcat": "instrumentation/jmx-metrics/model/tomcat.yaml",
    }
    assert manifest_path == "instrumentation/jmx-metrics/model/manifest.yaml"


def test_discover_jmx_model_paths_ignores_nested_paths(extractor, mock_client):
    mock_client.fetch_tree.return_value = [
        {"type": "blob", "path": "instrumentation/jmx-metrics/model/nested/jvm.yaml"},
    ]

    models, manifest_path = extractor.discover_jmx_model_paths("abc123")

    assert models == {}
    assert manifest_path is None


def test_fetch_model_delegates_to_client(extractor, mock_client):
    mock_client.fetch_raw_file.return_value = "models: []"

    content = extractor.fetch_model("instrumentation/jmx-metrics/model/jvm.yaml", "abc123")

    assert content == "models: []"
    mock_client.fetch_raw_file.assert_called_once_with("instrumentation/jmx-metrics/model/jvm.yaml", "abc123")
