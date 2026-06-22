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

"""Parser for JS instrumentation package metadata."""

import json
import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

SUPPORTED_VERSIONS_RE = re.compile(
    r"###?\s+Supported Versions\s*\n(.*?)(?=\n#+|\Z)",
    re.DOTALL | re.IGNORECASE,
)

VERSION_RANGE_RE = re.compile(
    r"\[`?([^`\]]+)`?\]\([^)]+\)\s+version[s]?\s+`([^`]+)`",
)


class PackageParser:
    """
    Parses metadata from a single JS instrumentation package directory.

    Reads package.json, .tav.yml, and README.md (supported versions only).
    Does not do general README scraping.
    """

    def __init__(
        self,
        package_path: Path,
        bundle_membership: set[str],
        component_owners: dict[str, list[str]],
    ):
        """
        Args:
            package_path: Path to the instrumentation package directory
            bundle_membership: Set of npm package names in auto-instrumentations-node
            component_owners: Dict of package path to owner list
        """
        self.package_path = package_path
        self.bundle_membership = bundle_membership
        self.component_owners = component_owners

    def parse(self) -> dict | None:
        """
        Parse all available metadata for this package.

        Returns:
            Dict of metadata fields, or None if package.json is missing/invalid
        """
        pkg_json = self._parse_package_json()
        if pkg_json is None:
            return None

        name = self.package_path.name
        npm_name = pkg_json.get("name", "")
        version = pkg_json.get("version", "")
        repo = pkg_json.get("repository", {})
        source_path = repo.get("directory", f"packages/{name}") if isinstance(repo, dict) else f"packages/{name}"

        owners_key = f"packages/{name}"
        owners = self.component_owners.get(owners_key, [])

        supported_versions = self._parse_supported_versions_from_readme()
        tested_versions = self._parse_tav_yml()

        return {
            "name": name,
            "npm_package": npm_name,
            "version": version,
            "description": pkg_json.get("description", ""),
            "source_path": source_path,
            "repository": "open-telemetry/opentelemetry-js-contrib",
            "node_engine": pkg_json.get("engines", {}).get("node", ""),
            "in_auto_instrumentations_node": npm_name in self.bundle_membership,
            "component_owners": owners,
            "supported_versions": supported_versions,
            "tested_versions": tested_versions,
        }

    def _parse_package_json(self) -> dict | None:
        """Read and parse package.json."""
        path = self.package_path / "package.json"
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to parse package.json for %s: %s", self.package_path.name, e)
            return None

    def _parse_supported_versions_from_readme(self) -> list[dict]:
        """
        Parse the Supported Versions section from README.md.

        Only reads the structured list under the heading — no general scraping.
        Results are sorted by (package, version_range) for deterministic
        registry output.

        Returns:
            List of dicts with 'package' and 'version_range' keys,
            or empty list if section is absent or unparseable
        """
        readme_path = self.package_path / "README.md"
        if not readme_path.exists():
            return []

        try:
            content = readme_path.read_text()
        except OSError as e:
            logger.debug("Could not read README for %s: %s", self.package_path.name, e)
            return []

        match = SUPPORTED_VERSIONS_RE.search(content)
        if not match:
            return []

        section = match.group(1)
        results = []
        for m in VERSION_RANGE_RE.finditer(section):
            results.append(
                {
                    "package": m.group(1),
                    "version_range": m.group(2),
                    "source": "README.md",
                }
            )

        return sorted(results, key=lambda x: (x["package"], x["version_range"]))

    def _build_tav_entry(self, pkg_name: str, versions: dict) -> dict:
        """
        Build a single tested_versions entry from a versions dict.

        Only 'mode' and 'exclude' are omitted when empty; 'package', 'range',
        and 'source' are always present.

        Args:
            pkg_name: The npm package name being tested
            versions: The versions dict from .tav.yml

        Returns:
            Dict with package, range, source, and optionally mode and exclude
        """
        entry: dict = {
            "package": pkg_name,
            "range": versions.get("include", ""),
            "source": ".tav.yml",
        }
        mode = versions.get("mode", "")
        if mode:
            entry["mode"] = mode
        exclude = versions.get("exclude", "")
        if exclude:
            entry["exclude"] = exclude
        return entry

    def _parse_tav_yml(self) -> list[dict]:
        """
        Parse .tav.yml for tested version ranges.

        Handles two .tav.yml structures found in js-contrib:

        Structure 1 — versions key (most packages):
            express:
              - versions:
                  include: ">=4.16.2 <6"
                  mode: latest-minors
                commands: npm test

        Structure 2 — jobs key (e.g. aws-sdk):
            "@aws-sdk/client-s3":
              jobs:
                - versions:
                    include: "^3.6.1"
                    exclude: "3.529.0"
                    mode: max-7
                  commands: [...]

        Results are sorted by (package, range, mode, exclude) for
        deterministic registry output, so upstream reordering of the
        YAML mapping doesn't churn the registry.

        Returns:
            List of dicts with package, range, source, and optionally
            mode and exclude fields. Only 'mode' and 'exclude' are
            omitted when empty.
        """
        tav_path = self.package_path / ".tav.yml"
        if not tav_path.exists():
            return []

        try:
            data = yaml.safe_load(tav_path.read_text())
        except (yaml.YAMLError, OSError) as e:
            logger.debug("Could not parse .tav.yml for %s: %s", self.package_path.name, e)
            return []

        if not isinstance(data, dict):
            return []

        results = []
        for pkg_name, config in data.items():
            if isinstance(config, list):
                # Structure 1: list of entries each with a versions key
                for entry in config:
                    versions = entry.get("versions", {})
                    if isinstance(versions, dict) and versions:
                        results.append(self._build_tav_entry(pkg_name, versions))
                        continue

                    # Structure 2: jobs key inside list entry
                    for job in entry.get("jobs", []):
                        v = job.get("versions", {})
                        if isinstance(v, dict) and v:
                            results.append(self._build_tav_entry(pkg_name, v))

            elif isinstance(config, dict):
                # Structure 2: top-level jobs key
                jobs = config.get("jobs", [])
                if jobs:
                    for job in jobs:
                        v = job.get("versions", {})
                        if isinstance(v, dict) and v:
                            results.append(self._build_tav_entry(pkg_name, v))
                else:
                    # Flat versions key directly on the config dict
                    versions = config.get("versions", {})
                    if isinstance(versions, dict) and versions:
                        results.append(self._build_tav_entry(pkg_name, versions))

        return sorted(
            results,
            key=lambda e: (
                e.get("package", ""),
                e.get("range", ""),
                e.get("mode", ""),
                str(e.get("exclude", "")),
            ),
        )
