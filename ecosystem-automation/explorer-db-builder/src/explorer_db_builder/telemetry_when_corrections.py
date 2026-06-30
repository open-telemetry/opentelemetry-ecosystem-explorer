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
"""Corrects known-bad telemetry ``when`` conditions in the registry.

Two operations are applied in order (ordering matters — see the servlet-5.0 note in the YAML):

1. **ignore_conditions** — any telemetry block whose ``when`` value appears in the ignore list is
   relabelled to ``"default"`` and merged into the existing ``default`` block, deduplicating
   identical signals.

2. **corrections** — each entry moves a specific signal from the ``default`` block to the correct
   ``to_when`` block.  Entries with ``applies_to_versions_before`` are skipped for versions at or
   after the cutoff (the registry data is already correct there).

Signal identity mirrors the PR #1 reconciliation key:
- span  → ``(span_kind, frozenset(attribute names))``
- metric → ``name``

``from_when`` is always ``"default"``; ``to_when`` is treated as an opaque string (some are
comma-joined combined conditions — never split them).
"""

import logging
from pathlib import Path
from typing import Any

import yaml
from semantic_version import Version

logger = logging.getLogger(__name__)

_CORRECTIONS_FILE = Path(__file__).parent / "telemetry_when_corrections.yaml"


def _load_corrections() -> dict[str, Any]:
    with open(_CORRECTIONS_FILE) as fh:
        return yaml.safe_load(fh)


# Loaded once at import time, consistent with how DECLARATIVE_NAME_CORRECTIONS works in the
# existing declarative_name_corrections module.
_CORRECTIONS: dict[str, Any] = _load_corrections()


# ---------------------------------------------------------------------------
# Signal-identity helpers
# ---------------------------------------------------------------------------


def _span_key(span: dict[str, Any]) -> tuple[str, frozenset[str]]:
    """Return the identity key for a span: ``(span_kind, frozenset(attribute names))``."""
    attrs = frozenset(a["name"] for a in (span.get("attributes") or []))
    return (span["span_kind"], attrs)


def _metric_key(metric: dict[str, Any]) -> str:
    """Return the identity key for a metric: its ``name``."""
    return metric["name"]


def _is_block_empty(block: dict[str, Any]) -> bool:
    """Return True if a telemetry block has no spans and no metrics."""
    return not (block.get("spans") or []) and not (block.get("metrics") or [])


def _find_block(telemetry: list[dict[str, Any]], when: str) -> dict[str, Any] | None:
    """Return the telemetry block whose ``when`` equals *when* (exact match), or None."""
    for block in telemetry:
        if block.get("when") == when:
            return block
    return None


# ---------------------------------------------------------------------------
# Pass 1 — ignore_conditions
# ---------------------------------------------------------------------------


def _apply_ignore_conditions(item: dict[str, Any], ignore_conditions: list[str]) -> None:
    """Fold any telemetry blocks whose ``when`` is in *ignore_conditions* into ``default``.

    The ignored blocks are test-harness artifacts, not real feature gates.  Their signals are
    merged into the ``default`` block (or a new ``default`` block is created if one does not yet
    exist), and identical signals are deduplicated.  The original ignored blocks are removed.

    Mutates *item* in place.
    """
    telemetry: list[dict[str, Any]] = item.get("telemetry") or []
    if not telemetry:
        return

    ignore_set = set(ignore_conditions)
    ignored = [b for b in telemetry if b.get("when") in ignore_set]
    if not ignored:
        return

    # Find or create the default block.
    default_block = _find_block(telemetry, "default")
    if default_block is None:
        default_block = {"when": "default"}
        # Insert before the first ignored block so default remains first.
        first_ignored_idx = next(i for i, b in enumerate(telemetry) if b.get("when") in ignore_set)
        telemetry.insert(first_ignored_idx, default_block)

    # Build lookup sets from the existing default block for deduplication.
    existing_span_keys: set[tuple[str, frozenset[str]]] = {_span_key(s) for s in (default_block.get("spans") or [])}
    existing_metric_keys: set[str] = {_metric_key(m) for m in (default_block.get("metrics") or [])}

    for ignored_block in ignored:
        for span in ignored_block.get("spans") or []:
            key = _span_key(span)
            if key not in existing_span_keys:
                default_block.setdefault("spans", []).append(span)
                existing_span_keys.add(key)
                logger.debug(
                    "ignore_conditions: merged span %s from '%s' into default for %s",
                    key,
                    ignored_block["when"],
                    item.get("name"),
                )
        for metric in ignored_block.get("metrics") or []:
            key = _metric_key(metric)
            if key not in existing_metric_keys:
                default_block.setdefault("metrics", []).append(metric)
                existing_metric_keys.add(key)
                logger.debug(
                    "ignore_conditions: merged metric '%s' from '%s' into default for %s",
                    key,
                    ignored_block["when"],
                    item.get("name"),
                )

        telemetry.remove(ignored_block)
        logger.debug(
            "ignore_conditions: dropped block when='%s' from %s",
            ignored_block["when"],
            item.get("name"),
        )

    item["telemetry"] = telemetry


# ---------------------------------------------------------------------------
# Pass 2 — corrections
# ---------------------------------------------------------------------------


def _apply_correction(item: dict[str, Any], correction: dict[str, Any], version: Version) -> None:
    """Move one signal from the ``default`` block to the ``to_when`` block.

    Skips silently if:
    - ``applies_to_versions_before`` is set and ``version >= that cutoff`` (data already correct).
    - The ``default`` block does not exist.
    - The target signal is not found in ``default``.

    Mutates *item* in place.
    """
    applies_before = correction.get("applies_to_versions_before")
    if applies_before and version >= Version(applies_before):
        return

    telemetry: list[dict[str, Any]] = item.get("telemetry") or []
    if not telemetry:
        return

    from_block = _find_block(telemetry, "default")
    if from_block is None:
        return

    to_when: str = correction["to_when"]
    matched_signal: dict[str, Any] | None = None

    if "span_kind" in correction:
        target_key = (
            correction["span_kind"],
            frozenset(correction.get("attributes") or []),
        )
        spans = from_block.get("spans") or []
        for span in spans:
            if _span_key(span) == target_key:
                matched_signal = span
                break

        if matched_signal is None:
            return

        from_block["spans"] = [s for s in spans if _span_key(s) != target_key]

    else:
        metric_name: str = correction["metric"]
        metrics = from_block.get("metrics") or []
        for metric in metrics:
            if _metric_key(metric) == metric_name:
                matched_signal = metric
                break

        if matched_signal is None:
            return

        from_block["metrics"] = [m for m in metrics if _metric_key(m) != metric_name]

    # Drop the from_when block if it is now empty.
    if _is_block_empty(from_block):
        telemetry.remove(from_block)
        logger.debug(
            "corrections: dropped empty default block from %s",
            item.get("name"),
        )

    # Find or create the to_when block and append the signal.
    to_block = _find_block(telemetry, to_when)
    if to_block is None:
        to_block = {"when": to_when}
        telemetry.append(to_block)

    if "span_kind" in correction:
        existing_spans = to_block.setdefault("spans", [])
        if not any(_span_key(s) == target_key for s in existing_spans):
            existing_spans.append(matched_signal)
            logger.debug(
                "corrections: moved span %s from default → '%s' in %s",
                _span_key(matched_signal),
                to_when,
                item.get("name"),
            )
        else:
            logger.debug(
                "corrections: span %s already exists in '%s' for %s, skipped appending duplicate",
                _span_key(matched_signal),
                to_when,
                item.get("name"),
            )
    else:
        existing_metrics = to_block.setdefault("metrics", [])
        if not any(_metric_key(m) == metric_name for m in existing_metrics):
            existing_metrics.append(matched_signal)
            logger.debug(
                "corrections: moved metric '%s' from default → '%s' in %s",
                _metric_key(matched_signal),
                to_when,
                item.get("name"),
            )
        else:
            logger.debug(
                "corrections: metric '%s' already exists in '%s' for %s, skipped appending duplicate",
                _metric_key(matched_signal),
                to_when,
                item.get("name"),
            )

    item["telemetry"] = telemetry


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def apply_telemetry_when_corrections(inventory: dict[str, Any], version: Version) -> dict[str, Any]:
    """Apply telemetry ``when``-condition corrections to *inventory* for *version*.

    Two passes are applied in order across every instrumentation in ``libraries`` and ``custom``:

    1. **ignore_conditions** — folds test-harness artifact blocks back into ``default``.
    2. **corrections** — moves misclassified signals to their correct ``when`` block.

    The inventory is mutated in place and also returned for convenience, mirroring the contract of
    :func:`apply_declarative_name_corrections`.

    Args:
        inventory: Raw inventory data from the registry (already through format transformation).
        version: The Java Agent version being processed.

    Returns:
        The same inventory dict, with corrected telemetry ``when`` conditions.
    """
    ignore_conditions: list[str] = _CORRECTIONS.get("ignore_conditions") or []
    corrections: list[dict[str, Any]] = _CORRECTIONS.get("corrections") or []

    # Pass 1: ignore_conditions — applied globally to every instrumentation.
    for key in ("libraries", "custom"):
        for item in inventory.get(key) or []:
            if not isinstance(item, dict):
                continue
            _apply_ignore_conditions(item, ignore_conditions)

    # Pass 2: corrections — each entry is scoped to a named instrumentation.
    # Build a fast name → item lookup once rather than scanning for every correction.
    name_to_item: dict[str, dict[str, Any]] = {}
    for key in ("libraries", "custom"):
        for item in inventory.get(key) or []:
            if isinstance(item, dict) and item.get("name"):
                name_to_item[item["name"]] = item

    for correction in corrections:
        instrumentation_name: str = correction.get("instrumentation", "")
        item = name_to_item.get(instrumentation_name)
        if item is None:
            continue
        _apply_correction(item, correction, version)

    return inventory
