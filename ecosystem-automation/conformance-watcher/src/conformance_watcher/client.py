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
"""Client for fetching conformance reports and resolving git revisions."""

import hashlib
import json
import logging
import os
import re
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

logger = logging.getLogger(__name__)

DEFAULT_REPOSITORY = "open-telemetry/semantic-conventions-conformance"
DEFAULT_REPORT_PATH = "docs/data/conformance.json"
SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")


class ConformanceClient:
    """Client for querying the upstream repository and fetching reports."""

    def __init__(
        self,
        repository: str = DEFAULT_REPOSITORY,
        token: str | None = None,
        base_api_url: str = "https://api.github.com",
        raw_base_url: str = "https://raw.githubusercontent.com",
        session: requests.Session | None = None,
    ):
        self.repository = repository
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.base_api_url = base_api_url.rstrip("/")
        self.raw_base_url = raw_base_url.rstrip("/")

        if session is not None:
            self.session = session
        else:
            self.session = requests.Session()
            retry = Retry(
                total=3,
                backoff_factor=1.0,
                status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=["GET"],
            )
            adapter = HTTPAdapter(max_retries=retry)
            self.session.mount("https://", adapter)
            self.session.mount("http://", adapter)

    def _headers(self, accept: str = "application/json") -> dict[str, str]:
        headers = {
            "Accept": accept,
            "User-Agent": "opentelemetry-ecosystem-explorer-conformance-watcher",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def resolve_revision(self, ref: str = "main") -> str:
        """Resolve a git reference (tag, branch name, or commit SHA) to a 40-char commit SHA."""
        if SHA_RE.match(ref):
            return ref.lower()

        url = f"{self.base_api_url}/repos/{self.repository}/commits/{ref}"
        response = self.session.get(url, headers=self._headers(), timeout=30)
        if response.status_code != 200:
            raise RuntimeError(
                f"Failed to resolve ref '{ref}' for repository '{self.repository}': "
                f"HTTP {response.status_code} - {response.text}"
            )

        data = response.json()
        sha = data.get("sha")
        if not sha or not isinstance(sha, str):
            raise RuntimeError(f"Unexpected response when resolving ref '{ref}': 'sha' field missing")
        return sha.lower()

    def fetch_report(
        self, revision: str, report_path: str = DEFAULT_REPORT_PATH
    ) -> tuple[dict[str, Any], bytes, str, str]:
        """Fetch conformance report JSON from the specified revision.

        Returns:
            Tuple of (parsed_data, canonical_bytes, full_digest, snapshot_id)
        """
        # First attempt via raw content endpoint
        raw_url = f"{self.raw_base_url}/{self.repository}/{revision}/{report_path}"
        response = self.session.get(raw_url, headers=self._headers("application/json"), timeout=30)

        if response.status_code != 200:
            # Fallback to API contents endpoint
            api_url = f"{self.base_api_url}/repos/{self.repository}/contents/{report_path}?ref={revision}"
            response = self.session.get(
                api_url,
                headers=self._headers("application/vnd.github.v3.raw"),
                timeout=30,
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Failed to fetch report from '{self.repository}' at {revision}:{report_path}: "
                    f"HTTP {response.status_code} - {response.text}"
                )

        try:
            report_data = response.json()
        except Exception as e:
            raise ValueError(f"Report at {revision}:{report_path} is not valid JSON: {e}") from e

        if not isinstance(report_data, dict):
            raise ValueError(f"Report at {revision}:{report_path} root is not a JSON object")

        # Canonicalize JSON for deterministic content hash
        canonical_bytes = json.dumps(report_data, sort_keys=True, separators=(",", ":")).encode("utf-8")
        full_digest = hashlib.sha256(canonical_bytes).hexdigest()
        snapshot_id = full_digest[:12]

        return report_data, canonical_bytes, full_digest, snapshot_id
