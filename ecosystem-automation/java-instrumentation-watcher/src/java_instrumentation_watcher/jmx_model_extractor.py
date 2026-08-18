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
"""Discovers and fetches JMX weaver model files from upstream Java instrumentation repo."""

import re

from .java_instrumentation_client import JavaInstrumentationClient

JMX_MODEL_FILE_RE = re.compile(r"^instrumentation/jmx-metrics/model/(?P<name>[^/]+)\.yaml$")


class JmxModelExtractor:
    """Discovers JMX weaver model and manifest YAML files from upstream Java repo."""

    def __init__(self, client: JavaInstrumentationClient):
        self.client = client

    def discover_jmx_model_paths(self, sha: str) -> tuple[dict[str, str], str | None]:
        """Return ({target_system: blob_path}, manifest_blob_path_or_none)."""
        tree = self.client.fetch_tree(sha)
        models: dict[str, str] = {}
        manifest_path: str | None = None

        for entry in tree:
            if entry.get("type") != "blob":
                continue
            path = entry.get("path")
            if not isinstance(path, str):
                continue
            match = JMX_MODEL_FILE_RE.match(path)
            if not match:
                continue

            file_stem = match.group("name")
            if file_stem == "manifest":
                manifest_path = path
            else:
                models[file_stem] = path

        return models, manifest_path

    def fetch_model(self, path: str, ref: str) -> str:
        """Fetch a single model file from upstream repository."""
        return self.client.fetch_raw_file(path, ref)
