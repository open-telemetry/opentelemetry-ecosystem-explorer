#!/usr/bin/env python3
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
"""Analyze the diff produced by a Build Explorer Database run.

Companion to the ``database-build-review`` skill. Diffs the content-addressed database between a
base ref and a PR/head ref by reading the ``versions/<v>-index.json`` manifests (the source of
truth for which blob each version uses), and reports:

* versions added / removed
* per-component hash churn, split into NEW-VERSION blobs vs HISTORICAL REWRITES (a version that
  already existed on base now points at a different blob) -- the number to scrutinize
* field-level diffs of the historical rewrites, GROUPED by identical change, so a normalization
  cascade shows up as one group covering N (component, version) pairs
* orphaned blobs: content files present on the head tree but no longer referenced by any manifest
  (expected leftovers of incremental add-only writes, but a *referenced* blob going missing is a bug)

Only the content-addressed ecosystems (``javaagent``, ``collector``) are supported; ``configuration``
is a schema tree, not per-component content-addressed -- review its diff directly.

Examples:
    python diff_build_pr.py --repo-root . --ecosystem javaagent --pr 889
    python diff_build_pr.py --repo-root . --ecosystem collector --head my-local-branch --base upstream/main
"""

import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field

# Resolve git's absolute path once so the subprocess calls pass a full path (satisfies ruff S607,
# "partial executable path"). If git isn't on PATH, which() returns None and we fall back to the
# bare "git" — a PATH lookup that surfaces a clear error at run time rather than lint time.
_GIT = shutil.which("git") or "git"

DATA_ROOT = "ecosystem-explorer/public/data"
UPSTREAM_SLUG = "open-telemetry/opentelemetry-ecosystem-explorer"

# Per-ecosystem layout: which manifest keys hold the {component: hash} maps, and where blobs live.
ECOSYSTEMS = {
    "javaagent": {"map_keys": ["instrumentations", "custom_instrumentations"], "content_subdir": "instrumentations"},
    "collector": {"map_keys": ["components"], "content_subdir": "components"},
}


def git(root: str, *args: str) -> str:
    """Run a git command in ``root`` and return stdout (stripped). Raises on failure."""
    result = subprocess.run([_GIT, "-C", root, *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout.strip()


def git_show(root: str, ref: str, path: str) -> str | None:
    """Return the contents of ``path`` at ``ref``, or None on any ``git show`` failure.

    None means the object couldn't be read — the usual case is a missing path at that ref, but it
    also covers an unknown ref, an ambiguous ref, or permission issues. Callers treat "unreadable"
    the same regardless of cause, so the reason isn't distinguished here.
    """
    result = subprocess.run([_GIT, "-C", root, "show", f"{ref}:{path}"], capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return result.stdout


def detect_upstream_remote(root: str) -> str | None:
    """Find the remote whose URL points at the canonical open-telemetry repo."""
    for line in git(root, "remote", "-v").splitlines():
        parts = line.split()
        if len(parts) >= 2 and UPSTREAM_SLUG in parts[1]:
            return parts[0]
    return None


def sanitize(name: str) -> str:
    """Mirror DatabaseWriter._sanitize_name so referenced-blob paths match on-disk filenames."""
    return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)


def list_manifest_paths(root: str, ref: str, ecosystem: str) -> list[str]:
    """List versions/<v>-index.json manifest paths for the ecosystem at ``ref``."""
    prefix = f"{DATA_ROOT}/{ecosystem}/versions/"
    out = subprocess.run(
        [_GIT, "-C", root, "ls-tree", "-r", "--name-only", ref, "--", prefix],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        return []
    return [p for p in out.stdout.splitlines() if p.endswith("-index.json")]


# A manifest can spread component names across several sections (javaagent uses both
# ``instrumentations`` and ``custom_instrumentations``). Those sections share one on-disk namespace,
# so a name could in principle appear in more than one — a plain merge would let one section
# silently overwrite the other and hide its churn. We namespace the in-memory keys by section to
# keep every (section, name) pair distinct, and strip the namespace back off when resolving the
# on-disk blob path or presenting a component to the reader.
_NS_SEP = "\x1f"  # ASCII unit separator: never appears in a component name.


def _bare_component(component: str) -> str:
    """Strip the manifest-section namespace that load_manifests() prepends to each key."""
    return component.rsplit(_NS_SEP, 1)[-1]


def load_manifests(root: str, ref: str, ecosystem: str) -> dict[str, dict[str, str]]:
    """Return {version: {section-namespaced component: hash}} for every manifest at ``ref``."""
    map_keys = ECOSYSTEMS[ecosystem]["map_keys"]
    manifests: dict[str, dict[str, str]] = {}
    for path in list_manifest_paths(root, ref, ecosystem):
        raw = git_show(root, ref, path)
        if raw is None:
            continue
        data = json.loads(raw)
        version = data.get("version") or path.rsplit("/", 1)[-1].removesuffix("-index.json")
        combined: dict[str, str] = {}
        for key in map_keys:
            for name, digest in (data.get(key) or {}).items():
                combined[f"{key}{_NS_SEP}{name}"] = digest
        manifests[version] = combined
    return manifests


@dataclass
class Report:
    new_versions: list[str] = field(default_factory=list)
    removed_versions: list[str] = field(default_factory=list)
    # (component, version) -> (old_hash, new_hash)
    historical_rewrites: dict[tuple[str, str], tuple[str, str]] = field(default_factory=dict)
    # (component, version) -> hash, for components newly added to a pre-existing version
    added_to_existing: dict[tuple[str, str], str] = field(default_factory=dict)
    new_version_blob_count: int = 0


def compare(base: dict[str, dict[str, str]], head: dict[str, dict[str, str]]) -> Report:
    """Diff two {version: {component: hash}} maps into a Report."""
    report = Report()
    report.new_versions = sorted(set(head) - set(base))
    report.removed_versions = sorted(set(base) - set(head))

    for version in report.new_versions:
        report.new_version_blob_count += len(head[version])

    for version in sorted(set(base) & set(head)):
        base_map, head_map = base[version], head[version]
        for component, new_hash in head_map.items():
            old_hash = base_map.get(component)
            if old_hash is None:
                report.added_to_existing[(component, version)] = new_hash
            elif old_hash != new_hash:
                report.historical_rewrites[(component, version)] = (old_hash, new_hash)
    return report


def blob_path(ecosystem: str, component: str, digest: str) -> str:
    subdir = ECOSYSTEMS[ecosystem]["content_subdir"]
    safe = sanitize(_bare_component(component))
    return f"{DATA_ROOT}/{ecosystem}/{subdir}/{safe}/{safe}-{digest}.json"


def field_diff(root: str, ecosystem: str, component: str, old_hash: str, new_hash: str, base: str, head: str) -> str:
    """Unified diff of a component's blob between the old and new hash. Empty string if unreadable."""
    old = git_show(root, base, blob_path(ecosystem, component, old_hash))
    new = git_show(root, head, blob_path(ecosystem, component, new_hash))
    if old is None or new is None:
        return ""
    diff_lines = [
        line
        for line in difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=0)
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    ]
    return "\n".join(diff_lines)


def referenced_blobs(manifests: dict[str, dict[str, str]], ecosystem: str) -> set[str]:
    """All blob paths referenced by any manifest."""
    refs: set[str] = set()
    for components in manifests.values():
        for component, digest in components.items():
            refs.add(blob_path(ecosystem, component, digest))
    return refs


def on_disk_blobs(root: str, ref: str, ecosystem: str) -> set[str]:
    """All component blob files present in the tree at ``ref``."""
    subdir = ECOSYSTEMS[ecosystem]["content_subdir"]
    prefix = f"{DATA_ROOT}/{ecosystem}/{subdir}/"
    out = subprocess.run(
        [_GIT, "-C", root, "ls-tree", "-r", "--name-only", ref, "--", prefix],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        return set()
    return {p for p in out.stdout.splitlines() if p.endswith(".json")}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo-root", required=True, help="Path to the repository checkout")
    parser.add_argument("--ecosystem", choices=sorted(ECOSYSTEMS), default="javaagent")
    parser.add_argument("--base", help="Base ref (default: <upstream-remote>/main)")
    parser.add_argument("--head", help="Head ref to review (use this OR --pr)")
    parser.add_argument("--pr", type=int, help="PR number to fetch from the upstream remote and review")
    parser.add_argument("--remote", help="Remote for --pr / base auto-detect (default: auto-detect open-telemetry)")
    parser.add_argument("--max-groups", type=int, default=20, help="Max change-groups to print (default: 20)")
    parser.add_argument(
        "--samples", type=int, default=3, help="Sample (component, version) pairs per group (default: 3)"
    )
    args = parser.parse_args()

    root = args.repo_root
    remote = args.remote or detect_upstream_remote(root)

    base = args.base
    if not base:
        if not remote:
            print("Could not auto-detect the open-telemetry remote; pass --base explicitly.", file=sys.stderr)
            return 2
        git(root, "fetch", remote, "main", "--quiet")
        base = f"{remote}/main"

    head = args.head
    if args.pr:
        if not remote:
            print("Could not auto-detect a remote to fetch the PR from; pass --remote.", file=sys.stderr)
            return 2
        head = f"refs/build-review/pr{args.pr}"
        git(root, "fetch", remote, f"pull/{args.pr}/head:{head}", "--quiet")
    if not head:
        print("Provide --head <ref> or --pr <number>.", file=sys.stderr)
        return 2

    print(f"Ecosystem : {args.ecosystem}")
    print(f"Base      : {base}")
    print(f"Head      : {head}{f' (PR #{args.pr})' if args.pr else ''}")
    print("=" * 78)

    base_manifests = load_manifests(root, base, args.ecosystem)
    head_manifests = load_manifests(root, head, args.ecosystem)
    report = compare(base_manifests, head_manifests)

    print("\n## Versions")
    print(f"  new versions     : {report.new_versions or '(none)'}")
    print(f"  removed versions : {report.removed_versions or '(none)'}")
    print(f"  new-version blobs : {report.new_version_blob_count} (expected additions for a release bump)")

    print("\n## Churn on pre-existing versions (the number to scrutinize)")
    print(f"  historical rewrites   : {len(report.historical_rewrites)} (component, version) pairs")
    print(f"  components added to    : {len(report.added_to_existing)} pre-existing versions (backfill?)")
    rewrite_components = sorted({c for (c, _v) in report.historical_rewrites})
    print(f"  distinct components rewritten: {len(rewrite_components)}")

    # Group historical rewrites by identical field-level diff.
    groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for (component, version), (old_hash, new_hash) in report.historical_rewrites.items():
        diff = field_diff(root, args.ecosystem, component, old_hash, new_hash, base, head)
        groups[diff].append((component, version))

    print(f"\n## Field-level change groups ({len(groups)} distinct changes)")
    for diff, pairs in sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)[: args.max_groups]:
        print("\n" + "-" * 78)
        print(f"[{len(pairs)} (component, version) pairs]")
        samples = sorted(pairs)[: args.samples]
        print(
            "  e.g. "
            + ", ".join(f"{_bare_component(c)}@{v}" for c, v in samples)
            + (" ..." if len(pairs) > len(samples) else "")
        )
        if diff:
            for line in diff.splitlines():
                print("    " + line)
        else:
            print("    (blob content unreadable at one of the refs; inspect manually)")
    if len(groups) > args.max_groups:
        print(f"\n  ... {len(groups) - args.max_groups} more groups (raise --max-groups to see them)")

    # Orphans: blobs on disk (head) not referenced by any head manifest.
    disk = on_disk_blobs(root, head, args.ecosystem)
    referenced = referenced_blobs(head_manifests, args.ecosystem)
    orphans = sorted(disk - referenced)
    missing = sorted(referenced - disk)
    print("\n## Orphans and integrity")
    print(f"  orphaned blobs (on disk, unreferenced): {len(orphans)}")
    for path in orphans[:20]:
        print(f"    {path}")
    if len(orphans) > 20:
        print(f"    ... {len(orphans) - 20} more")
    print(f"  MISSING referenced blobs (bug if > 0)  : {len(missing)}")
    for path in missing[:20]:
        print(f"    !! {path}")

    print("\n" + "=" * 78)
    verdict = (
        "clean release bump"
        if not report.historical_rewrites
        else "historical rewrites present -- classify each group (see skill step 3)"
    )
    print(
        f"Summary: {len(report.new_versions)} new version(s), {len(report.historical_rewrites)} historical rewrite(s) "
        f"in {len(groups)} change group(s), {len(orphans)} orphan(s). -> {verdict}"
    )
    if missing:
        print("WARNING: referenced blobs are missing from the tree -- investigate before merging.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
