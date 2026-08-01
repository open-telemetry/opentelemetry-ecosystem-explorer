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
"""Corrects known-bad configuration metadata from the registry.

Three classes of correction live here, all operating on the inline ``configurations`` shape
(so they must run *after* :func:`instrumentation_transformer.transform_instrumentation_format`
has resolved catalog/ref formats like 0.6 to inline 0.5):

1. ``declarative_name`` rewrites, plus normalizing the structured peer-service-mapping config
   (inject the declarative schema, force the system-property ``type`` back to ``map`` —
   v2.29.0 regressed it to ``structured_list``).
2. **name fallback** — declarative-only configs (introduced in file_format 0.6) may carry only a
   ``declarative_name`` and no legacy system-property ``name``. Downstream keys configs on
   ``name`` (release-comparison diff, global-configurations aggregation, metadata backfill), so a
   missing ``name`` renders blank / drops the config. We fall back to ``declarative_name``.
3. **description normalization** — pins a curated set of configs' ``description`` to their newest
   value across versions, so cosmetic upstream rewordings of shared configs don't surface as
   spurious per-library changes in the release comparison.

Can be removed after the upstream metadata changes land in a java agent release.
See:
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/18883
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/19077
"""

import copy
import logging
from typing import Any

from semantic_version import Version

logger = logging.getLogger(__name__)

DECLARATIVE_NAME_CORRECTIONS: dict[str, str] = {
    "java.common.peer_service_mapping": "java.common.service_peer_mapping",
}

# Configs (keyed by ``declarative_name``) whose ``description`` is normalized to the newest
# version's value across all versions. These are shared/common configs whose descriptions were
# reworded upstream (pure prose changes, no semantic change), which otherwise show up as a
# "changed" config in every library that references them. Pinning to the newest description per
# (instrumentation, config name) collapses that cross-version noise without picking a single
# global canonical — a config's description can legitimately differ between libraries.
DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES: frozenset[str] = frozenset(
    {
        "java.common.http.client.emit_experimental_telemetry/development",
        "java.common.http.server.emit_experimental_telemetry/development",
        "java.common.messaging.capture_headers/development",
        "java.common.db.query_sanitization.enabled",
    }
)

# Configs that the agent supported before upstream documented them in the registry metadata.
# They first appear in a given version but the capability predates it, so the release comparison
# would otherwise show them as spuriously "added". Back-populate each into earlier versions (of the
# libraries that carry it in its newest version) so it reads as pre-existing.
#
# Keyed by ``declarative_name``; the value is an inclusive version floor (only back-populate down to
# that version), or ``None`` to treat the config as having always existed. Remove an entry once
# upstream backfills the config into the historical metadata itself.
UNDERDOCUMENTED_CONFIG_BACKFILL: dict[str, str | None] = {
    # url_template_rules was gated behind emit-experimental-telemetry long before it became its own
    # documented config in 2.29.1.
    "java.common.http.client.url_template_rules": None,
}


def apply_declarative_name_corrections(inventory: dict[str, Any]) -> dict[str, Any]:
    """Rewrite known-bad configuration ``declarative_name`` values in place.

    Walks every configuration entry under the inventory's ``libraries`` and ``custom`` lists and
    replaces any ``declarative_name`` found in ``DECLARATIVE_NAME_CORRECTIONS`` with its corrected
    value. The inventory is mutated in place and also returned for convenience.

    Args:
        inventory: Raw inventory data from the registry.

    Returns:
        The same inventory dict, with corrected declarative names.
    """
    if not DECLARATIVE_NAME_CORRECTIONS:
        return inventory

    for key in ("libraries", "custom"):
        for item in inventory.get(key) or []:
            if not isinstance(item, dict):
                continue
            for config in item.get("configurations") or []:
                if not isinstance(config, dict):
                    continue
                original_name = config.get("declarative_name")
                corrected = DECLARATIVE_NAME_CORRECTIONS.get(original_name)

                if corrected is not None:
                    config["declarative_name"] = corrected
                    logger.debug(
                        "Corrected declarative_name %r -> %r for config %r",
                        original_name,
                        corrected,
                        config.get("name"),
                    )

                current_name = config.get("declarative_name")
                # Key off the stable config ``name`` (not declarative_name): the registry shape of
                # peer-service-mapping drifted across releases and converges only here.
                #   <=2.27.0 : declarative_name unset, type=map, no schema
                #   2.28.x   : declarative_name set, type=map, structured schema present
                #   2.29.0   : type regressed to structured_list
                # Forcing the full canonical shape on every version (see upstream PR #19077) removes
                # the spurious cross-version diff: type=map on the system-property/env-var form,
                # declarative_type=structured_list only on the declarative form. This is idempotent
                # once #19077 lands in a release.
                if config.get("name") == "otel.instrumentation.common.peer-service-mapping":
                    config["declarative_name"] = "java.common.service_peer_mapping"
                    config["type"] = "map"
                    config["declarative_type"] = "structured_list"
                    config["declarative_schema"] = {
                        "type": "object",
                        "required": ["peer", "service_name"],
                        "properties": {
                            "peer": {"type": "string", "description": "Host name or IP address to match against."},
                            "service_name": {
                                "type": "string",
                                "description": "Peer service name to record for matching peers.",
                            },
                        },
                    }
                elif current_name and current_name.endswith("url_template_rules"):
                    config["declarative_type"] = "structured_list"
                    config["declarative_schema"] = {
                        "type": "object",
                        "required": ["pattern", "template"],
                        "properties": {
                            "pattern": {
                                "type": "string",
                                "description": "Regular expression matched against the request URL.",
                            },
                            "template": {
                                "type": "string",
                                "description": "Template used to derive the low-cardinality route.",
                            },
                            "override": {
                                "type": "boolean",
                                "default": False,
                                "description": "Whether this rule overrides an already-applied template.",
                            },
                        },
                    }

                # Name fallback for declarative-only configs (file_format 0.6+): downstream keys
                # configs on ``name``, so use the declarative_name as the stable identifier when the
                # legacy system-property name is absent. Done last so it sees the corrected
                # declarative_name above.
                if not config.get("name") and current_name:
                    config["name"] = current_name

    return inventory


def _iter_configs(inventory: dict[str, Any]):
    """Yield every configuration dict from an inventory's ``libraries`` and ``custom`` lists,
    paired with its owning instrumentation name: ``(instrumentation_name, config)``."""
    for key in ("libraries", "custom"):
        for item in inventory.get(key) or []:
            if not isinstance(item, dict):
                continue
            instrumentation_name = item.get("name")
            for config in item.get("configurations") or []:
                if isinstance(config, dict):
                    yield instrumentation_name, config


def normalize_config_descriptions(inventories_newest_first: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pin whitelisted configs' ``description`` to their newest-version value across all versions.

    For every config whose ``declarative_name`` is in
    :data:`DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES`, the description from the newest version in
    which it appears (with a non-empty description) is applied to that same config
    ``(instrumentation, name)`` in every version. This removes spurious "changed" entries in the
    release comparison caused by upstream reworking a shared config's prose.

    Inventories must be newest-first (the same ordering ``build_global_configurations`` expects).
    The inventory dicts are mutated in place and also returned for convenience.

    Args:
        inventories_newest_first: Per-version inventories, newest version first.

    Returns:
        The same list, with normalized config descriptions.
    """
    # Pass 1: record the newest non-empty description per (instrumentation, config name).
    newest_description: dict[tuple[str | None, str | None], str] = {}
    for inventory in inventories_newest_first:
        for instrumentation_name, config in _iter_configs(inventory):
            if config.get("declarative_name") not in DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES:
                continue
            key = (instrumentation_name, config.get("name"))
            description = config.get("description")
            if description and key not in newest_description:
                newest_description[key] = description

    # Pass 2: apply the newest description to every version.
    for inventory in inventories_newest_first:
        for instrumentation_name, config in _iter_configs(inventory):
            if config.get("declarative_name") not in DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES:
                continue
            canonical = newest_description.get((instrumentation_name, config.get("name")))
            if canonical is not None and config.get("description") != canonical:
                logger.debug(
                    "Normalized description for %s/%s to newest-version value",
                    instrumentation_name,
                    config.get("name"),
                )
                config["description"] = canonical

    return inventories_newest_first


def backfill_underdocumented_configs(
    versioned_inventories_newest_first: list[tuple[Version, dict[str, Any]]],
) -> list[tuple[Version, dict[str, Any]]]:
    """Back-populate configs from :data:`UNDERDOCUMENTED_CONFIG_BACKFILL` into earlier versions.

    For each whitelisted ``declarative_name``, the newest occurrence of that config on each
    instrumentation is used as the template. A deep copy is injected into every earlier version
    (down to the entry's inclusive floor) of that same instrumentation that does not already carry
    the config. This keeps a config the agent supported all along from showing as spuriously
    "added" in the release comparison the moment upstream first documents it.

    The config is only injected into instrumentations that are already present in the older version
    (never resurrects a library that didn't exist yet). Inventory dicts are mutated in place; the
    ``(version, inventory)`` list must be newest-version first.

    Args:
        versioned_inventories_newest_first: ``(version, inventory)`` pairs, newest version first.

    Returns:
        The same list, with under-documented configs back-populated.
    """
    for declarative_name, floor in UNDERDOCUMENTED_CONFIG_BACKFILL.items():
        floor_version = Version(floor) if floor else None

        # Template = the newest config object per instrumentation that carries this declarative_name.
        template_by_instrumentation: dict[str | None, dict[str, Any]] = {}
        template_version_by_instrumentation: dict[str | None, Version] = {}
        for template_version, inventory in versioned_inventories_newest_first:
            for instrumentation_name, config in _iter_configs(inventory):
                if (
                    config.get("declarative_name") == declarative_name
                    and instrumentation_name not in template_by_instrumentation
                ):
                    template_by_instrumentation[instrumentation_name] = config
                    template_version_by_instrumentation[instrumentation_name] = template_version

        if not template_by_instrumentation:
            continue

        for version, inventory in versioned_inventories_newest_first:
            if floor_version is not None and version < floor_version:
                continue
            for key in ("libraries", "custom"):
                for item in inventory.get(key) or []:
                    if not isinstance(item, dict):
                        continue
                    instrumentation_name = item.get("name")
                    template = template_by_instrumentation.get(instrumentation_name)
                    template_version = template_version_by_instrumentation.get(instrumentation_name)
                    if template is None or template_version is None:
                        continue
                    if version > template_version:
                        continue
                    configurations = item.get("configurations")
                    if not isinstance(configurations, list):
                        configurations = []
                        item["configurations"] = configurations
                    already_present = any(
                        isinstance(c, dict) and c.get("declarative_name") == declarative_name for c in configurations
                    )
                    if already_present:
                        continue
                    configurations.append(copy.deepcopy(template))
                    logger.debug(
                        "Back-populated under-documented config %s into %s @ %s",
                        declarative_name,
                        item.get("name"),
                        version,
                    )

    return versioned_inventories_newest_first
