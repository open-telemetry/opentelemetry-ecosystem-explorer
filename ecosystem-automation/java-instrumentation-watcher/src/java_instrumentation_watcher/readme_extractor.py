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
"""Discovers and fetches library README files from the upstream Java instrumentation repo."""

import logging
import re

from .java_instrumentation_client import JavaInstrumentationClient

logger = logging.getLogger(__name__)

# Matches: instrumentation/<anything>/library/README.md
LIBRARY_README_RE = re.compile(r"^instrumentation/(?P<source>.+)/library/README\.md$")


class ReadmeExtractor:
    """Discovers and fetches library README files from upstream Java repo."""

    def __init__(self, client: JavaInstrumentationClient):
        self.client = client

    def discover_library_readmes(self, sha: str) -> dict[str, str]:
        """Return {source_path: blob_path} for all library READMEs at the given commit SHA.

        Keyed by source_path (matching YAML's `source_path` field) so callers
        can resolve names via the parsed instrumentation list.
        """
        tree = self.client.fetch_tree(sha)
        out: dict[str, str] = {}
        for entry in tree:
            if entry.get("type") != "blob":
                continue
            m = LIBRARY_README_RE.match(entry["path"])
            if m:
                source = f"instrumentation/{m.group('source')}"
                out[source] = entry["path"]
        return out

    def fetch_readme(self, path: str, ref: str) -> str:
        return self.client.fetch_raw_file(path, ref)
