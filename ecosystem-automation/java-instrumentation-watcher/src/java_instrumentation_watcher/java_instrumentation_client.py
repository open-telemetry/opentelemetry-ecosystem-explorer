"""GitHub API client for fetching data."""

from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry


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
        """
        Fetch the instrumentation list YAML file from the repository.

        Args:
            ref: Git reference (branch, tag, or commit SHA). Default is "main".

        Returns:
            Content of the instrumentation list YAML file as a string.
        """
        url = f"https://raw.githubusercontent.com/{self.REPO}/{ref}/{self.LIST}"
        try:
            response = self._session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            raise GithubAPIError(f"Error fetching instrumentation list: {e}") from e
