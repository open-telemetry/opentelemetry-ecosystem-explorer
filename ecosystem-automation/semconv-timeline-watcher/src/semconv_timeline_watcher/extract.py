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

"""Turn a structured model diff plus changelog evidence into reviewable candidates.

The rules are deliberately conservative. A candidate is proposed only for a stability transition
into ``release_candidate``/``stable``, a move to ``deprecated``, a namespace that appears, or a
namespace that disappears. Everything else (new subjects in existing namespaces, renamed or
reorganised groups, requirement-level and documentation changes) is counted but never proposed.
Changelog wording alone never creates a candidate; it only corroborates one or raises an
ambiguity. A candidate is a request for review, never an accepted event.
"""

import re
from collections import Counter, defaultdict

from .model_diff import Snapshot, namespace_of

PROMOTED = ("release_candidate", "stable")
EXTRACTOR = "model-stability-diff"
_PROMOTION_WORDING = re.compile(r"promot|release[_ ]candidate|\bstable\b", re.IGNORECASE)
_REMOVAL_WORDING = re.compile(r"\bmov(?:e|ed|es)\b|\bremov|\bdeprecat", re.IGNORECASE)
_MAX_SUBJECTS = 10
_MAX_LINKS = 5


def _norm(namespace: str) -> str:
    return namespace.replace("_", "-").lower()


def lane_for(namespace: str, lanes: list[dict]) -> dict | None:
    return next((lane for lane in lanes if _norm(namespace) in {_norm(n) for n in lane["namespaces"]}), None)


def candidate_id(review_key: str, kind: str, namespace: str, target: str) -> str:
    return f"{review_key}/{kind}/{_norm(namespace)}/{target}"


def _label(state: str | None) -> str:
    return state if state else "unknown"


def _entries_for(entries: list[dict], namespace: str) -> list[dict]:
    return [e for e in entries if _norm(namespace) in {_norm(s) for s in e["scope"]}]


def _links(model_files: list[str], repository: str, sha: str, entries: list[dict]) -> list[dict]:
    links = [
        {"label": f"model: {path}", "url": f"{repository}/blob/{sha}/{path}"} for path in sorted(set(model_files))[:3]
    ]
    for entry in entries:
        links.extend({"label": f"change #{ref['number']}", "url": ref["url"]} for ref in entry["references"])
    seen, unique = set(), []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            unique.append(link)
    return unique[: _MAX_LINKS + 3]


def extract_candidates(
    *,
    source_id: str,
    review_key: str,
    repository: str,
    sha: str,
    before: Snapshot,
    after: Snapshot,
    entries: list[dict],
    lanes: list[dict],
) -> dict:
    """Compare two snapshots. Returns ``{candidates, gaps, structure}``."""
    gaps: list[dict] = []
    transitions: dict[tuple[str, str | None, str | None], list[tuple[str, str]]] = defaultdict(list)
    before_ns, after_ns = Counter(), Counter()
    removed_by_ns: dict[str, int] = Counter()
    for subject in before.subjects:
        before_ns[namespace_of(subject[1])] += 1
    for subject in after.subjects:
        after_ns[namespace_of(subject[1])] += 1
    for subject, state in after.subjects.items():
        if subject in before.subjects and before.subjects[subject] != state:
            transitions[(namespace_of(subject[1]), before.subjects[subject], state)].append(subject)
    for subject in before.subjects:
        if subject not in after.subjects:
            removed_by_ns[namespace_of(subject[1])] += 1

    proposals: list[dict] = []

    def propose(kind: str, namespace: str, target: str, **fields) -> None:
        proposals.append({"kind": kind, "namespace": namespace, "target": target, **fields})

    # Stability promotions and deprecations, grouped by namespace and target state.
    grouped: dict[tuple[str, str], dict] = {}
    for (namespace, old, new), subjects in sorted(transitions.items(), key=lambda kv: str(kv[0])):
        if new in PROMOTED:
            kind = "stability"
        elif new == "deprecated" and old != "deprecated":
            kind = "deprecation"
        else:
            continue
        entry = grouped.setdefault((namespace, new), {"kind": kind, "from": Counter(), "subjects": [], "files": []})
        entry["from"][_label(old)] += len(subjects)
        entry["subjects"] += [name for _, name in subjects]
        entry["files"] += [after.files[s] for s in subjects if s in after.files]
    for (namespace, new), entry in sorted(grouped.items()):
        propose(entry["kind"], namespace, new, **{k: entry[k] for k in ("from", "subjects", "files")})

    # A namespace that appears or disappears wholesale.
    for namespace in sorted(set(after_ns) - set(before_ns)):
        propose(
            "domain",
            namespace,
            "new",
            subjects=sorted(n for (_, n) in after.subjects if namespace_of(n) == namespace),
            files=[f for s, f in after.files.items() if namespace_of(s[1]) == namespace],
            **{"from": Counter()},
        )
    for namespace in sorted(set(before_ns) - set(after_ns)):
        propose(
            "removed",
            namespace,
            "removed",
            subjects=sorted(n for (_, n) in before.subjects if namespace_of(n) == namespace),
            files=[f for s, f in before.files.items() if namespace_of(s[1]) == namespace],
            **{"from": Counter()},
        )

    # Lanes whose accepted migration out of this source is part of this diff: namespaces next to them that
    # no lane claims (provider-specific ones, for example) may belong to the same move.
    moving = sorted(
        {
            f"{lane['id']} ({lane['migration']['eventId']})"
            for p in proposals
            if (lane := lane_for(p["namespace"], lanes))
            and lane.get("migration")
            and lane["migration"]["from"] == source_id
        }
    )
    candidates, proposed_ns = [], set()
    for p in proposals:
        namespace, kind, target = p["namespace"], p["kind"], p["target"]
        lane = lane_for(namespace, lanes)
        migration = lane.get("migration") if lane else None
        if migration and migration["from"] == source_id:
            gaps.append(
                {
                    "kind": "info",
                    "message": f"namespace {namespace} belongs to lane {lane['id']}, whose migration "
                    f"({migration['eventId']}) is already accepted; changes to the old definitions "
                    "are not proposed.",
                }
            )
            continue
        related = _entries_for(entries, namespace)
        subjects = sorted(p["subjects"])
        warnings = ["Requires human review: a candidate is evidence, not an accepted event."]
        if lane is None:
            warnings.append(f"Namespace {namespace} is not bound to any lane; choose a lane or exclude it.")
        if lane is None and moving and kind in ("deprecation", "removed"):
            warnings.append(
                f"This revision also moves {', '.join(moving)}; check whether {namespace} is part of that move "
                "before treating it as a separate milestone."
            )
        if kind == "deprecation":
            warnings.append(
                "A deprecation may only record an earlier decision; check the pull request before dating it."
            )
        if kind in ("domain", "removed"):
            warnings.append(
                "Appearance or disappearance of a namespace cannot distinguish a new domain, removal, "
                "rename or move; compare with other namespaces and repositories."
            )
        if any(_REMOVAL_WORDING.search(e["body"]) for e in related) and kind in ("removed", "deprecation"):
            warnings.append("The changelog mentions a move, removal or deprecation for this namespace.")
        total = after_ns.get(namespace, 0) or before_ns.get(namespace, 0)
        if kind == "stability":
            transition = f"{namespace}: selected subjects → {target.replace('_', ' ')}"
            reasons = [
                f"{len(subjects)} of {total} {namespace}.* subjects changed stability "
                f"({', '.join(f'{k}: {v}' for k, v in sorted(p['from'].items()))}) into {target}.",
            ]
        elif kind == "deprecation":
            transition = f"{namespace}: subjects → deprecated"
            reasons = [f"{len(subjects)} of {total} {namespace}.* subjects became deprecated."]
        elif kind == "domain":
            transition = f"{namespace}: namespace introduced"
            reasons = [f"No {namespace}.* subject existed in the baseline; {len(subjects)} exist now."]
        else:
            transition = f"{namespace}: namespace removed"
            reasons = [f"All {len(subjects)} {namespace}.* subjects of the baseline are gone."]
        if kind == "stability" and len(subjects) < total:
            warnings.append(f"Scoped change ({len(subjects)} of {total}); do not describe the whole namespace.")
        proposed_ns.add(namespace)
        candidates.append(
            {
                "id": candidate_id(review_key, kind, namespace, target),
                "kind": kind,
                "proposedType": kind,
                "lane": lane["id"] if lane else None,
                "namespace": namespace,
                "transition": transition,
                "scope": {"changed": len(subjects), "total": total},
                "fromStates": dict(sorted(p["from"].items())),
                "subjects": subjects[:_MAX_SUBJECTS],
                "evidence": _links(p["files"], repository, sha, related),
                "changelog": [{"text": e["text"], "references": e["references"]} for e in related][:_MAX_LINKS],
                "reasons": reasons,
                "warnings": warnings,
                "requiresReview": True,
                "disposition": None,
            }
        )

    # Wording that suggests a milestone the structured diff does not show: an ambiguity, not a candidate.
    for entry in entries:
        for scope in entry["scope"] or ["(no scope)"]:
            if _norm(scope) in {_norm(n) for n in proposed_ns}:
                continue
            if _PROMOTION_WORDING.search(entry["body"]) or _REMOVAL_WORDING.search(entry["body"]):
                gaps.append(
                    {
                        "kind": "ambiguity",
                        "message": f"Changelog entry for {scope} suggests a milestone ({entry['text'][:120]!r}) but "
                        "the structured diff shows none: it may back-reference an earlier release or "
                        "describe a reorganisation.",
                    }
                )

    added = len(after.structure - before.structure)
    removed = len(before.structure - after.structure)
    new_in_existing = sum(1 for s in after.subjects if s not in before.subjects and namespace_of(s[1]) in before_ns)
    return {
        "candidates": sorted(candidates, key=lambda c: c["id"]),
        "gaps": gaps,
        "structure": {
            "groupsAdded": added,
            "groupsRemoved": removed,
            "subjectsAddedToExistingNamespaces": new_in_existing,
        },
    }
