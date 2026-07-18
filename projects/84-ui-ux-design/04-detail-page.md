---
title: "Phase 5 — Component detail page"
issue: 84
type: plan
phase: 5
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Project 04 — Component detail page

The atom of the explorer. The canonical, linkable page for a single component — overview,
configuration, and what changed across versions.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) (tab:
**Detail**) · [`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md)

---

## TL;DR

Replace the current detail page with a three-pane layout: left sibling navigator, center embedded
content (overview + tabs for Configuration / README / Attributes / Examples + a "Where this fits"
pipeline diagram), right version timeline + diff + compatibility card.

**Suggested split into two PRs** so review stays manageable:

- **PR 04a** — Three-pane shell + embedded docs (header, sibling nav, tabbed content,
  pipeline-placement diagram).
- **PR 04b** — Version timeline + diff view + compatibility card.

## Goal

A user landing on the detail page should be able to:

1. Identify the component in <2s (header, type, stability, version).
2. See where it fits in a pipeline without reading docs.
3. Find the right config key in <10s (search inside config table).
4. Understand what changed since the last version they used.

A maintainer should be able to link to a specific section of the page
(`/.../components/kafkareceiver#configuration`) from a code review or docs PR.

## Scope (in)

### Three-pane shell (PR 04a)

- **Sub-nav** with full breadcrumbs (`Explorer › Collector › Receivers › Kafka Receiver`).
- **Left rail (sticky)**:
  - Sibling navigator — list of all components of the same type within the ecosystem (e.g., 98
    receivers), with the current one highlighted in OTel orange. Filter input at the top.
    Scrollable.
  - On-page anchor links (Overview / Configuration / Emitted attributes / Pipeline placement /
    Version history).
- **Center column**:
  - **Header card** — type-stripe, eyebrow ("Receiver · contrib"), title, slug, status pill, current
    version, signal badges, GitHub + Docs links.
  - **"Where this fits"** — mini pipeline diagram showing the component placed in a typical pipeline
    (`Kafka Receiver → batch → resource → otlp exporter`). Other stages link to canonical
    components.
  - **Tabbed content area** (Bootstrap `nav-tabs`):
    - **Configuration** — striped table of Key / Type / Default / Description for the current
      version.
    - **README** — embedded markdown rendered from the component's repo.
    - **Emitted attributes** — table of attributes/metrics/spans the component emits (from the
      registry, where available).
    - **Examples** — config snippets and link-outs to example deployments.
- **Right rail (sticky)** — placeholder cards for v1 of PR 04a; populated in PR 04b.
- **Empty / error states**: _not yet released for this version_, _deprecated/removed_, _missing data
  (parse failure)_, _no docs yet_. Each gets a designed empty state — not a stack trace.

### Version timeline + diff (PR 04b)

- **Right rail content**:
  - **Version history timeline** — vertical timeline of the last N versions (default 4–6, with "show
    more"), current version highlighted. Each version shows a one-line summary of what changed for
    _this component_ (added keys, deprecated keys, stability change). Scrollable.
  - **Diff selector** — `Compare from [v0.149.0] → [v0.150.0]` selects two versions; clicking "Diff
    →" navigates to a diff view.
  - **Compatibility card** — Min collector / Min Go (or runtime) / Distribution / License.
- **Diff view** (`/.../components/<slug>/diff?from=v0.149.0&to=v0.150.0`):
  - Side-by-side or unified view of config schema changes (added / removed / renamed / type-changed
    keys).
  - Stability transitions noted (`alpha → beta`).
  - Newly emitted / deprecated attributes.
  - README diff (optional, behind a "Show README diff" toggle to keep the default fast).

## Out of scope

- Live `try-it-now` config validator — v2.
- Side-by-side three-way diff (v0.148 vs. v0.149 vs. v0.150) — v2 if asked.
- Comments / reactions on a component page — v2.
- Code samples in arbitrary languages (we link to the repo's own examples for v1).
- Search _within_ the detail page (Cmd+F is fine for v1; nice-to-have later).

## Dependencies

- **Project 00 — Foundation** (NavBar, SubNav, theme, StatusPill, TypeStripe, Card primitive).
- **Project 03 — List page** (the URL state contract — the sibling navigator pulls from the same
  registry slice the list page uses).
- **`ecosystem-registry` data shape** — we need per-component config schemas, emitted attributes,
  and version history. If any of these aren't yet exposed, they're a prerequisite to PR 04b at
  minimum, and to the Configuration tab in PR 04a.

## Tasks

### PR 04a — Shell + embedded docs

1. **Detail-page route** — `/<ecosystem>/components/<slug>`. Fetches component data, handles 404 /
   missing-version states gracefully.
2. **Three-pane layout** — responsive: three columns ≥1200px, two columns 992–1199px (rail +
   content, version-rail collapses into bottom), single column on mobile (sibling nav becomes a
   drawer).
3. **SiblingNavigator component** — list + filter + sticky scroll. Reuses the same data fetch as the
   list page.
4. **OnPageAnchors component** — auto-generated from H2 sections.
5. **DetailHeader component** — type-stripe, metadata row, action links.
6. **PipelinePlacement component** — small horizontal diagram with the current component
   highlighted, other stages linkable to their detail pages.
7. **DetailTabs component** — `nav-tabs`-style Bootstrap tabs with URL hash state (`#configuration`,
   `#readme`, etc.).
8. **ConfigurationTable component** — striped table for Key / Type / Default / Description. Reuses
   foundation table styling.
9. **ReadmeRenderer component** — markdown renderer with safe HTML, code-block syntax highlighting,
   anchor links for headings. Sourced from the component's repo (see open questions).
10. **AttributesTable component** — for emitted attributes/metrics/spans.
11. **ExamplesTab component** — config snippets + outbound links.
12. **Empty/error state library** — four states (no data, deprecated, missing version, parse
    failure). Each renders helpful next steps, not a stack trace.

### PR 04b — Version timeline + diff

1. **VersionTimeline component** — vertical, the last N versions, current highlighted, per-version
   summary line. Scrollable.
2. **DiffSelector component** — two version dropdowns + "Diff →" navigation.
3. **CompatibilityCard component** — simple key/value list.
4. **`/<ecosystem>/components/<slug>/diff` route** — reads `from` / `to` from query, computes the
   schema diff, renders side-by-side view.
5. **SchemaDiff engine** — pure function that compares two version's config schemas and produces a
   structured diff (added / removed / renamed / type-changed). Lives in a `lib/` so it's testable in
   isolation.
6. **README diff (optional toggle)** — behind a button so it doesn't slow the default view.

## Acceptance criteria

### PR 04a

- The current detail page is replaced; landing on a real component renders all four tabs
  (Configuration / README / Attributes / Examples) without errors.
- Sibling navigator highlights the active component and is keyboard-navigable.
- All four empty/error states are reachable in development (e.g., `/.../components/_test_missing`
  triggers the deprecated state).
- "Where this fits" pipeline placement renders for receivers, processors, exporters, connectors, and
  extensions — each with a sensible default pipeline.
- Page renders under both themes, with WCAG AA contrast in all four tabs.
- All H2 sections are independently linkable (`#configuration`, `#emitted-attributes`, etc.).

### PR 04b

- Version timeline shows the last N versions with per-version one-liners.
- Diff selector navigates to a diff view that correctly identifies added / removed / renamed /
  type-changed config keys for a known sample (covered by unit tests on the `SchemaDiff` engine).
- Stability transitions (`alpha → beta`) are surfaced in the timeline summary.
- Compatibility card renders with stable, predictable content (no "undefined" leaking through).

## Open questions

- **README source**: do we render markdown sourced from each component's `README.md` in the upstream
  repo (build-time fetch + cache), or rely on `ecosystem-registry` to provide pre-rendered HTML?
- **Per-version config schemas**: does `ecosystem-registry` already capture per-version snapshots,
  or is that a data-pipeline prereq before PR 04b can ship?
- **Emitted attributes**: same question — is this data already in the registry, or do we need a new
  extraction step?
- **Diff view URL shape**: `?from=v0.149.0&to=v0.150.0` (current proposal) vs. a path-based
  `/.../diff/v0.149.0...v0.150.0` (more git-flavored). Both are fine; pick one and lock it in.
- **Stability terminology** — same dependency as Project 03. Need to align with `ecosystem-registry`
  maintainers before locking timeline display.
- Do we need a print stylesheet for the detail page? (Some users will want to print the config
  table.)
