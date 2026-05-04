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
"""GitHub API client for fetching data."""

import logging
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry

logger = logging.getLogger(__name__)

class GithubAPIError(Exception):
    """Custom exception for GitHub API errors."""

    pass


class JavaInstrumentationClient:
    REPO = "open-telemetry/opentelemetry-java-instrumentation"
    LIST = "docs/instrumentation-list.yaml"
    TIMEOUT = 30

    def __init__(self, github_token: Optional[str] = None):
        """
        Args:
            github_token: Optional GitHub token for authentication
        """
        self.github_token = github_token
        self._session = requests.Session()

        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)

        if self.github_token:
            self._session.headers.update({"Authorization": f"Bearer {self.github_token}"})

    def get_latest_release_tag(self) -> str:
        """Get the latest release tag from the GitHub repository.

        Returns:
            Latest release tag as a string (e.g., "v2.24.0")
        """
        url = f"https://api.github.com/repos/{self.REPO}/releases/latest"
        try:
            response = self._session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            data = response.json()
            return data["tag_name"]
        except requests.RequestException as e:
            raise GithubAPIError(f"Error fetching latest release tag: {e}") from e
        except (KeyError, ValueError) as e:
            raise GithubAPIError(f"Unexpected API response format: {e}") from e

    def fetch_instrumentation_list(self, ref: str = "main") -> str:
        """Fetch the instrumentation list YAML file from the repository at the given ref."""
        return self.fetch_raw_file(self.LIST, ref)

    def resolve_ref_to_sha(self, ref: str) -> str:
        """Resolve a tag/branch/sha to a commit SHA via GET /repos/{REPO}/commits/{ref}."""
        url = f"https://api.github.com/repos/{self.REPO}/commits/{ref}"
        try:
            resp = self._session.get(url, timeout=self.TIMEOUT)
            resp.raise_for_status()
            return resp.json()["sha"]
        except (requests.RequestException, KeyError, ValueError) as e:
            raise GithubAPIError(f"Failed to resolve ref {ref!r}: {e}") from e

    def fetch_tree(self, sha: str) -> list[dict]:
        """Recursively fetch the git tree at a commit SHA. Returns the `tree` array."""
        url = f"https://api.github.com/repos/{self.REPO}/git/trees/{sha}?recursive=1"
        try:
            resp = self._session.get(url, timeout=self.TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            if data.get("truncated"):
                logger.warning(f"Tree at {sha} was truncated; README discovery may be incomplete")
            return data.get("tree", [])
        except (requests.RequestException, ValueError) as e:
            raise GithubAPIError(f"Failed to fetch tree for {sha}: {e}") from e

    def fetch_raw_file(self, path: str, ref: str) -> str:
        """Fetch a raw file from raw.githubusercontent.com at the given ref."""
        url = f"https://raw.githubusercontent.com/{self.REPO}/{ref}/{path}"
        try:
            resp = self._session.get(url, timeout=self.TIMEOUT)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            raise GithubAPIError(f"Failed to fetch {path} at {ref}: {e}") from e