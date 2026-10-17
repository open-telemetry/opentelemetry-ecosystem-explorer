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

"""Minimal GitHub REST client for release listing and review-issue upserts."""

import logging
from collections.abc import Iterator

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry

logger = logging.getLogger(__name__)

API = "https://api.github.com"
PER_PAGE = 100


class GitHubError(RuntimeError):
    """A GitHub API request failed after retries."""


class GitHubClient:
    TIMEOUT = 30

    def __init__(self, token: str | None = None, session: requests.Session | None = None):
        self._session = session or requests.Session()
        # Only idempotent GETs are retried; a POST that may have succeeded is never repeated.
        adapter = HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504]))
        self._session.mount("https://", adapter)
        self._session.headers.update({"Accept": "application/vnd.github+json"})
        if token:
            self._session.headers.update({"Authorization": f"Bearer {token}"})

    def _request(self, method: str, path: str, **kwargs):
        try:
            response = self._session.request(method, f"{API}{path}", timeout=self.TIMEOUT, **kwargs)
            response.raise_for_status()
        except requests.RequestException as e:
            raise GitHubError(f"{method} {path} failed: {e}") from e
        return response.json()

    def _pages(self, path: str, params: dict | None = None) -> Iterator[dict]:
        page = 1
        while True:
            batch = self._request("GET", path, params={**(params or {}), "per_page": PER_PAGE, "page": page})
            yield from batch
            if len(batch) < PER_PAGE:
                return
            page += 1

    def releases(self, repo: str) -> Iterator[dict]:
        """Every release of ``owner/name``, all pages. Callers filter drafts and prereleases."""
        yield from self._pages(f"/repos/{repo}/releases")

    def find_issue(self, repo: str, marker: str, label: str) -> dict | None:
        """The issue (open or closed) whose body carries *marker*; pull requests are skipped."""
        for issue in self._pages(f"/repos/{repo}/issues", {"state": "all", "labels": label}):
            if "pull_request" not in issue and marker in (issue.get("body") or ""):
                return issue
        return None

    def create_issue(self, repo: str, title: str, body: str, labels: list[str]) -> dict:
        return self._request("POST", f"/repos/{repo}/issues", json={"title": title, "body": body, "labels": labels})

    def update_issue(self, repo: str, number: int, **fields) -> dict:
        return self._request("PATCH", f"/repos/{repo}/issues/{number}", json=fields)

    def comment(self, repo: str, number: int, body: str) -> dict:
        return self._request("POST", f"/repos/{repo}/issues/{number}/comments", json={"body": body})
