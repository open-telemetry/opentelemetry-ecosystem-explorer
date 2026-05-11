---
title: "Next Steps — Legacy Registry Research"
issue: 119
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-05-11"
---

## Current State

Research phase complete. Findings are in [`00-research.md`](./00-research.md).

The core finding is that V2 is already the upstream data source for V1 version updates via the
collector-sync script. The question now is whether and how to expand that relationship.

---

## Proposals

### Proposal A: Expand collector-sync to sync more fields from V2 to V1

**What it is**: Extend the existing collector-sync automation to push additional V2 fields into V1
entries, not just the version. Specifically: stability level, display name, description, and
codeowners.

**Why it helps**: V1 entries would stay more accurate automatically. Users of the opentelemetry.io
registry would see up-to-date stability information instead of stale or missing data.

**Challenges**:
- V1 has fields (license, authors, tags) that V2 does not track. Those fields would still need
  to be maintained manually in V1.
- The matching logic (V2 component name to V1 entry) would need to handle renames and
  deprecations gracefully.
- Some V1 entries point to components outside core and contrib (third-party distributions). V2
  does not have data for these so they would be skipped by automation.

**Effort**: Medium. The collector-sync script already has the scaffolding. Adding fields is
incremental work.

---

### Proposal B: Use V2 to auto-generate new V1 entries for components that exist in V2 but not V1

**What it is**: Run a comparison between V2 (core + contrib) and V1 on a schedule. For any
component in V2 that has no matching V1 entry, generate a draft V1 entry with the fields that V2
can supply and open a PR for human review before merging.

**Why it helps**: New components added to contrib would automatically get a V1 registry entry
without waiting for someone to notice they are missing. This addresses the biggest gap in V1
maintenance today.

**Challenges**:
- The generated entry would be missing V1-only fields (license, authors, tags). A review step
  is essential.
- Need to establish a reliable matching key between the two registries (Go module path is the
  most stable option).

**Effort**: Medium. Requires a new script or extending the collector-watcher.

---

### Proposal C: Add a V1 sync task to the existing collector-watcher

**What it is**: Add a new output step to the ecosystem-automation/collector-watcher that, in
addition to writing V2 registry YAML files, also writes or updates V1-format YAML files in a
staging folder. These staged files can then be submitted to opentelemetry.io via the
collector-sync workflow.

**Why it helps**: Keeps the two registries in sync as a single automated pipeline rather than two
separate tools. The collector-watcher already runs nightly so V1 would get the same freshness.

**Challenges**:
- Requires coordination with the opentelemetry.io maintainers to integrate the staging output.
- V1-only fields (license, authors) would need a side-channel data source.

**Effort**: Medium-high. Requires changes to collector-watcher and a new integration with
opentelemetry.io automation.

---

### Proposal D: Document and stabilize the current state before changing anything

**What it is**: Before automating further, write a clear description of the current V1 schema,
document which fields are auto-managed vs manually maintained, and get agreement from
opentelemetry.io maintainers on which proposals they would accept.

**Why it helps**: Changes to V1 affect the opentelemetry.io website directly. Doing this without
maintainer alignment risks breaking things or creating PRs that will be closed.

**Effort**: Low. Primarily communication and documentation work.

---

## Recommended Order

1. **Start with Proposal D**: Share this research document with the opentelemetry.io maintainers
   and the ecosystem-explorer team to get alignment on direction before writing code.
2. **Then Proposal A**: Extend collector-sync to sync stability and description from V2 to V1.
   This is the lowest-risk and highest-value first step.
3. **Then Proposal B**: Automate detection of new components missing from V1.
4. **Proposal C** is the long-term goal but requires the most coordination.

---

## Open Questions

1. Are there V1 entries for components that have been removed from contrib? If so, should they be
   marked deprecated or removed from V1?
2. Who owns the V1 registry day-to-day? Is there a team or just individual contributors?
3. Does the Hugo shortcode version-injection rely on the exact `package.version` format in V1?
   If V2 changes its versioning scheme, would that break the shortcode?
4. Should third-party distribution components (not in core or contrib) ever be added to V2, or
   should V1 remain the only place for those?
