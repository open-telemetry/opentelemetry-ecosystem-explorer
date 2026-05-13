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
"""NuGet API client for fetching .NET instrumentation data."""

import logging
from typing import Any, Dict, List

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry

logger = logging.getLogger(__name__)


class NuGetAPIError(Exception):
    """Custom exception for NuGet API errors."""

    pass


class DotNetInstrumentationClient:
    """Client for fetching .NET instrumentation metadata from NuGet."""

    SERVICE_INDEX_URL = "https://api.nuget.org/v3/index.json"
    OWNER = "OpenTelemetry"
    TIMEOUT = 30

    def __init__(self):
        """Initialize the client."""
        self._session = requests.Session()
        self._search_url = None

        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)

    def _get_search_url(self) -> str:
        """Resolve the search URL from the NuGet service index."""
        if self._search_url:
            return self._search_url

        try:
            response = self._session.get(self.SERVICE_INDEX_URL, timeout=self.TIMEOUT)
            response.raise_for_status()
            index_data = response.json()
            for resource in index_data.get("resources", []):
                if resource.get("@type") == "SearchQueryService":
                    self._search_url = resource.get("@id")
                    return self._search_url
        except requests.RequestException as e:
            logger.error(f"Error fetching NuGet service index: {e}")

        # Fallback to a known endpoint if index fetch fails
        return "https://azuresearch-usnc.nuget.org/query"

    def fetch_instrumentation_list(self) -> Dict[str, Any]:
        """
        Fetch instrumentation list by querying NuGet for packages owned by OpenTelemetry.
        """
        all_packages = self._fetch_all_packages_by_owner(self.OWNER)
        modules = []

        for pkg in all_packages:
            package_id = pkg.get("id", "")

            # Skip deprecated and Contrib packages (which are considered legacy/deprecated)
            if pkg.get("deprecation") or package_id.startswith("OpenTelemetry.Contrib."):
                logger.info(f"  Skipping deprecated/contrib package: {package_id}")
                continue
            version = pkg.get("version", "")
            description = pkg.get("description", "")

            # Filter and classify packages
            if "Instrumentation" in package_id:
                component_type = "instrumentation"
            elif "Exporter" in package_id:
                component_type = "exporter"
            elif "Extensions" in package_id or "Resources" in package_id or "Sampler" in package_id:
                component_type = "extension"
            else:
                # Skip core packages like OpenTelemetry, OpenTelemetry.Api unless they match patterns
                # but we might want to include them as 'core' if needed.
                # For now, let's stick to the previous classification logic.
                continue

            modules.append(
                {
                    "name": package_id,
                    "description": description or f"{package_id} for OpenTelemetry",
                    "type": component_type,
                    "version": version,
                }
            )

        # Sort by name for consistency
        modules.sort(key=lambda x: x["name"])

        return {"modules": modules}

    def get_core_version(self) -> str:
        """
        Get the latest version of the core OpenTelemetry package.
        This is used as the 'ecosystem version' for the registry.
        """
        params = {
            "q": "PackageId:OpenTelemetry",
            "prerelease": "false",
            "take": 1,
        }
        try:
            search_url = self._get_search_url()
            response = self._session.get(search_url, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            data = response.json()
            if data.get("data"):
                return data["data"][0]["version"]
            return "1.0.0"
        except (requests.RequestException, KeyError, IndexError) as e:
            logger.error(f"Error fetching core version: {e}")
            return "1.0.0"

    def _fetch_all_packages_by_owner(self, owner: str) -> List[Dict[str, Any]]:
        """Fetch all packages for a specific owner using pagination."""
        packages = []
        skip = 0
        take = 20

        while True:
            params = {
                "q": f"owner:{owner}",
                "prerelease": "true",
                "skip": skip,
                "take": take,
            }
            try:
                search_url = self._get_search_url()
                response = self._session.get(search_url, params=params, timeout=self.TIMEOUT)
                response.raise_for_status()
                data = response.json()

                batch = data.get("data", [])
                packages.extend(batch)

                if len(batch) < take:
                    break

                skip += take
            except requests.RequestException as e:
                raise NuGetAPIError(f"Error fetching packages from NuGet: {e}") from e

        return packages
