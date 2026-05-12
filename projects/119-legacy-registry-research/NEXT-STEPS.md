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

**Correction from reviewer feedback**: An earlier version of the research claimed that V2 was
already feeding V1 via `collector-sync`. That was wrong. `collector-sync` writes to
`data/collector/` files that power Hugo shortcodes, not to the per-component `data/registry/`
entries. The V1 registry is updated by a separate `otelbot` nightly workflow that reads from the Go
module index. V1 and V2 are fully independent today. The question is whether to build a new
connection between them.

---

## Proposals

### Proposal A: Build a new V2 to data/registry/ sync path

**What it is**: Write a new script or workflow that reads V2 registry data and updates the matching
V1 entries under `data/registry/` in the opentelemetry.io repo. Fields to sync would include
stability level, display name, description, and codeowners. This is a new pipeline, not an extension
of collector-sync (which does not touch `data/registry/`).

**Why it helps**: V1 entries would stay more accurate automatically. Users of the opentelemetry.io
registry would see up-to-date stability information instead of stale or missing data.

**Challenges**:

- V1 has fields (license, authors, tags) that V2 does not track. Those fields would still need to be
  maintained manually in V1.
- The new sync path would need to coexist with the existing `otelbot` nightly job, which is today
  the source of truth for the `package.version` field.
- The matching logic (V2 component name to V1 entry) would need to handle renames and deprecations
  gracefully.
- Some V1 entries point to components outside core and contrib (third-party distributions). V2 does
  not have data for these so they would be skipped by automation.

**Effort**: Medium. Requires writing a new sync script and integrating it with the opentelemetry.io
automation.

---

### Proposal B: Use V2 to auto-generate new V1 entries for components that exist in V2 but not V1

**What it is**: Run a comparison between V2 (core + contrib) and V1 on a schedule. For any component
in V2 that has no matching V1 entry, generate a draft V1 entry with the fields that V2 can supply
and open a PR for human review before merging.

**Why it helps**: New components added to contrib would automatically get a V1 registry entry
without waiting for someone to notice they are missing. This addresses the biggest gap in V1
maintenance today.

**Challenges**:

- V1 is currently maintained entirely by hand. Introducing a mix of manually maintained and
  auto-generated entries could confuse contributors. A clear convention for marking which fields are
  auto-generated would be needed so contributors know not to edit those fields manually.
- The generated entry would be missing V1-only fields (license, authors, tags). A review step is
  essential before any generated entry is merged.
- Need to establish a reliable matching key between the two registries (Go module path is the most
  stable option).

**Suggested incremental path**:

Before committing to full automation, a dry-run experiment would be valuable to validate the
matching logic and the quality of the generated output. Smaller investigation steps before that:

1. Determine whether `license` can be derived automatically. All contrib components are Apache 2.0,
   so this field may be inferrable without a sidecar.
2. Determine whether `tags` are actually required for the opentelemetry.io registry search and
   filtering. If the tags are predictable from component type and language, they could also be
   generated rather than manually assigned.

If both of those are derivable, the set of fields requiring manual input shrinks to `authors` and
`createdAt`, which makes the human review step much lighter.

**Effort**: Medium. Requires a new script or extending the collector-watcher.

---

### Proposal C: Add a V1 sync task to the existing collector-watcher

**What it is**: Add a new output step to the ecosystem-automation/collector-watcher that, in
addition to writing V2 registry YAML files, also writes or updates V1-format YAML files in a staging
folder. These staged files can then be submitted to opentelemetry.io via the collector-sync
workflow.

**Why it helps**: Keeps the two registries in sync as a single automated pipeline rather than two
separate tools. The collector-watcher already runs nightly so V1 would get the same freshness.

**Challenges**:

- Requires coordination with the opentelemetry.io maintainers to integrate the staging output.
- V1-only fields (license, authors) would need a side-channel data source.

**Effort**: Medium-high. Requires changes to collector-watcher and a new integration with
opentelemetry.io automation.

---

### Proposal E: Invert the relationship — make V2 the source of truth and V1 a generated artifact

**What it is**: Instead of syncing V2 data into V1, flip the ownership model entirely. A new nightly
emitter in `ecosystem-automation/` reads V2 registry data and regenerates
`opentelemetry.io/data/registry/collector-*.yml` directly. For the fields V2 does not yet carry
(license, authors, tags), a thin per-entry sidecar file is maintained alongside the emitter.
`createdAt` is derivable from release history and does not need to be stored manually. The `otelbot`
nightly job is retired because the emitter sets `package.version` directly.

**Why it helps**: The opentelemetry.io website does not change at all. Same URLs, same Hugo
templates, same `version-from-registry` shortcode, same MiniSearch index. Nothing user-facing moves.
Compared to Proposal A, this approach removes a moving part (otelbot) rather than adding a new sync
layer that has to coexist with otelbot writing the same fields. As other ecosystem watchers come
online, the sidecar shrinks and the emitter coverage grows naturally.

**Challenges**:

- Requires writing a new emitter in ecosystem-automation and coordinating its output format with the
  opentelemetry.io maintainers.
- The sidecar file for V1-only fields (license, authors, tags) needs a clear ownership model and an
  initial population pass.
- Retiring otelbot requires agreement from the opentelemetry.io team since it currently owns version
  updates for all registry entries, not just collector ones.

**Effort**: Medium-high. New emitter plus coordination across two repositories.

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

1. **Start with Proposal D**: Share this research document with the opentelemetry.io maintainers and
   the ecosystem-explorer team to get alignment on direction before writing code.
2. **Then Proposal A**: Extend collector-sync to sync stability and description from V2 to V1. This
   is the lowest-risk and highest-value first step.
3. **Then Proposal B**: Automate detection of new components missing from V1.
4. **Proposal C** is the long-term goal but requires the most coordination.

---

## Open Questions

1. Are there V1 entries for components that have been removed from contrib? If so, should they be
   marked deprecated or removed from V1?
2. Who owns the V1 registry day-to-day? Is there a team or just individual contributors?
3. Does the Hugo shortcode version-injection rely on the exact `package.version` format in V1? If V2
   changes its versioning scheme, would that break the shortcode?
4. Should third-party distribution components (not in core or contrib) ever be added to V2, or
   should V1 remain the only place for those?
