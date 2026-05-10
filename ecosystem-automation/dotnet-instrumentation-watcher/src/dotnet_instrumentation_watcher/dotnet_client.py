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
"""GitHub API client for fetching .NET instrumentation data."""

from typing import Dict, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry


class GithubAPIError(Exception):
    """Custom exception for GitHub API errors."""

    pass


class DotNetInstrumentationClient:
    """Client for fetching .NET instrumentation metadata from GitHub."""

    REPO = "open-telemetry/opentelemetry-dotnet-contrib"
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
        """Get the latest release tag from the GitHub repository."""
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

    def fetch_instrumentation_list(self, ref: str = "main") -> Dict:
        """
        Fetch instrumentation list by dynamically extracting data from .csproj files.
        """
        url = f"https://api.github.com/repos/{self.REPO}/git/trees/{ref}?recursive=1"
        try:
            response = self._session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            tree_data = response.json().get("tree", [])

            modules = []
            for item in tree_data:
                path = item.get("path", "")
                if path.endswith(".csproj") and path.startswith("src/") and "Tests" not in path:
                    package_name = path.split("/")[-1].replace(".csproj", "")

                    if "Instrumentation" in package_name:
                        component_type = "instrumentation"
                    elif "Exporter" in package_name:
                        component_type = "exporter"
                    else:
                        component_type = "extension"

                    modules.append(
                        {
                            "name": package_name,
                            "description": f"{package_name} for OpenTelemetry",
                            "type": component_type,
                            "version": "1.0.0",
                        }
                    )

            return {"modules": modules}

        except requests.RequestException as e:
            raise GithubAPIError(f"Error fetching instrumentation list: {e}") from e
