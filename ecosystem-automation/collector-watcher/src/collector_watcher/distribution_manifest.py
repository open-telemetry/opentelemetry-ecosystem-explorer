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
"""Distribution membership sourced from opentelemetry-collector-releases manifests.

core and contrib are scanned from their source repositories. The other distributions
(otlp, k8s, prometheus, ebpf-profiler) are builds assembled from components that live in
those repositories, and the authoritative list of what each one ships is its builder
``manifest.yaml`` in opentelemetry-collector-releases. This module turns a manifest into
a registry record naming the core/contrib components it includes, rather than copying
component metadata a second time.
"""

import logging
from typing import Any

import yaml
from semantic_version import Version
from watcher_common.version_detector import VersionDetector

from .inventory_manager import InventoryManager
from .type_defs import COMPONENT_TYPES, MANIFEST_DISTRIBUTIONS, ManifestDistributionName

logger = logging.getLogger(__name__)

RELEASES_REPOSITORY = "opentelemetry-collector-releases"

# Go module path prefix -> the repository (registry distribution) whose components it names.
_MODULE_PREFIXES = {
    "go.opentelemetry.io/collector/": "core",
    "github.com/open-telemetry/opentelemetry-collector-contrib/": "contrib",
}

# Builder manifest sections that list components. ``providers`` and ``converters`` are
# confmap plumbing, not pipeline components, so they are not catalogued.
_MANIFEST_SECTIONS = ("receivers", "processors", "exporters", "extensions", "connectors")


def manifest_path(distribution: ManifestDistributionName) -> str:
    """Repository-relative path of a distribution's builder manifest."""
    return f"distributions/{MANIFEST_DISTRIBUTIONS[distribution]}/manifest.yaml"


def _resolve_gomod(gomod: str) -> dict[str, str] | None:
    """Map a manifest ``gomod`` entry to a core/contrib component, or None if it is external.

    Entries look like ``go.opentelemetry.io/collector/receiver/otlpreceiver v0.162.0``. The
    path after the repository prefix is ``{type}/{name}`` or, for nested components,
    ``{type}/{subtype}/{name}``; the registry names a component by its directory name.
    """
    module = gomod.split()[0] if gomod else ""
    for prefix, source in _MODULE_PREFIXES.items():
        if module.startswith(prefix):
            parts = module[len(prefix) :].split("/")
            if len(parts) in (2, 3) and parts[0] in COMPONENT_TYPES:
                return {"type": parts[0], "source": source, "name": parts[-1]}
    return None


def parse_manifest(content: str) -> dict[str, list[Any]]:
    """Parse builder manifest text into resolved and external component lists.

    Returns:
        ``{"components": [...], "external": [...]}``. ``components`` are core/contrib
        components as ``{type, source, name}`` sorted for deterministic output; ``external``
        are gomod module paths (without version) that live outside core/contrib and so have
        no registry record.
    """
    data = yaml.safe_load(content) or {}
    components: set[tuple[str, str, str]] = set()
    external: set[str] = set()

    for section in _MANIFEST_SECTIONS:
        for entry in data.get(section) or []:
            gomod = entry.get("gomod", "") if isinstance(entry, dict) else ""
            resolved = _resolve_gomod(gomod)
            if resolved:
                components.add((resolved["type"], resolved["source"], resolved["name"]))
            elif gomod:
                external.add(gomod.split()[0])

    return {
        "components": [{"type": t, "source": s, "name": n} for t, s, n in sorted(components)],
        "external": sorted(external),
    }


class DistributionManifestSync:
    """Records which core/contrib components each releases-repo distribution ships."""

    def __init__(self, releases_repo: str, inventory_manager: InventoryManager):
        self.detector = VersionDetector(releases_repo)
        self.inventory_manager = inventory_manager

    def sync_version(self, distribution: ManifestDistributionName, version: Version, overwrite: bool = False) -> bool:
        """Write ``distribution``'s manifest record for ``version`` from its release tag.

        Idempotent: an existing record is left alone unless ``overwrite`` is set. Reads the
        manifest straight from the tag, so the clone's checkout state is irrelevant.

        Returns:
            True if a record was written. False if one already existed or the distribution
            has no manifest at that tag (it did not exist yet, or the tag is not published).
        """
        if not overwrite and self.inventory_manager.distribution_manifest_exists(distribution, version):
            return False

        content = self.detector.read_file_at_ref(f"v{version}", manifest_path(distribution))
        if content is None:
            logger.debug("No %s manifest at v%s", distribution, version)
            return False

        parsed = parse_manifest(content)
        self.inventory_manager.save_distribution_manifest(
            distribution, version, RELEASES_REPOSITORY, parsed["components"], parsed["external"]
        )
        logger.info(
            "  Saved %s %s manifest (%d components, %d external)",
            distribution,
            version,
            len(parsed["components"]),
            len(parsed["external"]),
        )
        return True

    def sync(
        self,
        distributions: list[ManifestDistributionName] | None = None,
        versions: list[Version] | None = None,
        overwrite: bool = False,
    ) -> int:
        """Record manifests for the given distributions across the given versions.

        ``versions`` defaults to every release tracked for core or contrib, so a release's
        manifests are picked up on the first run after the releases repo tags it.

        Returns:
            Number of manifest records written.
        """
        distributions = distributions or list(MANIFEST_DISTRIBUTIONS)
        if versions is None:
            tracked = set(self.inventory_manager.list_release_versions("core"))
            tracked.update(self.inventory_manager.list_release_versions("contrib"))
            versions = sorted(tracked)

        written = 0
        for distribution in distributions:
            for version in versions:
                if self.sync_version(distribution, version, overwrite=overwrite):
                    written += 1
        return written
