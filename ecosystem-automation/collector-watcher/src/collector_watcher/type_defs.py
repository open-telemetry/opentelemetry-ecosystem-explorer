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
"""Shared type definitions for collector-watcher.

This module contains common type aliases used across the codebase.
"""

from typing import Literal

DistributionName = Literal["core", "contrib"]

# Every distribution whose membership is read from its builder manifest in
# opentelemetry-collector-releases, mapped to its directory name under ``distributions/``.
# core and contrib are also scanned from their repositories for component metadata, but what
# they ship (the otelcol and otelcol-contrib builds) is defined by the manifest, and includes
# components from both repositories.
ManifestDistributionName = Literal["core", "contrib", "otlp", "k8s", "prometheus", "ebpf-profiler"]
MANIFEST_DISTRIBUTIONS: dict[ManifestDistributionName, str] = {
    "core": "otelcol",
    "contrib": "otelcol-contrib",
    "otlp": "otelcol-otlp",
    "k8s": "otelcol-k8s",
    "prometheus": "otelcol-prometheus",
    "ebpf-profiler": "otelcol-ebpf-profiler",
}

# Repositories the watcher clones: the scanned distributions plus the releases repo.
RepositoryName = Literal["core", "contrib", "releases"]

COMPONENT_TYPES = ["connector", "exporter", "extension", "processor", "receiver"]
