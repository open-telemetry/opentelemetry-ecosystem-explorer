---
title: "Phase 4 — List pages"
issue: 84
type: plan
phase: 4
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Project 03 — List pages

The biggest UX win — make 200+ components actually browseable. Faceted, sortable,
density-toggleable, URL-shareable.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) (tab:
**List**) · [`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md)

---

## TL;DR

Replace the Search + Type + Version filter row with a real left-rail facet panel (Type, Signal,
Stability, Distribution, Version), add a density toggle (Cards / Compact / Table), surface active
filters as removable chips, and persist all state to the URL so anyone can share a deep link.

## Goal

A user pasted into Slack:
`https://.../collector/components?type=receiver&signal=traces&distribution=contrib` should land
their teammate on exactly that filtered slice. A casual visitor should be able to browse with one
hand, scrolling through a dense list of components, with the most-decision-critical signals
(stability, type, signals) perceivable at a glance.

## Scope (in)

- **Sub-nav** with breadcrumbs (`Explorer › Collector › Components`).
- **Page header**: gradient title, result count ("Showing 42 of 200+"), view toggle (Cards / Compact
  / Table — default Compact), sort dropdown (Name / Recently updated / Stability).
- **Active filter chips** rendered as Bootstrap-style `badge text-bg-secondary rounded-pill` with ×
  dismiss + a "Clear all" button.
- **Left-rail facet panel** (sticky on desktop, collapsible drawer on mobile):
  - **Search** — name + description filter, debounced.
  - **Type** facet with type-stripe color indicators and counts (Receiver, Processor, Exporter,
    Connector, Extension).
  - **Signal** facet with counts (Traces, Metrics, Logs, Baggage).
  - **Stability** facet with status-pill color indicators (Stable, Beta, Alpha, Deprecated).
  - **Distribution** facet (Core vs. Contrib).
  - **Version** dropdown (latest by default, can pick historical).
- **Result rows** (Compact view, default):
  - 4px left-edge **type-stripe** (foundation primitive).
  - Name + slug (monospace) + truncated description.
  - Type label (text).
  - Signals (comma-joined, truncated).
  - Status pill on the right.
  - Alternating-row striping.
- **Result cards** (Cards view):
  - Same data, presented as a 3-column grid; richer, less dense.
- **Result table** (Table view):
  - Power-user view. Same data, but rendered as a real `<table>` with sortable headers and tight row
    height.
- **Pagination** at 50 rows; or virtualization at scale (TBD per data volume).
- **URL state** — every facet, sort, and density choice round-trips via query params (e.g.,
  `?type=receiver&signal=traces&distribution=contrib&sort=updated&density=compact`).

## Out of scope

- A real full-text search backend — v1 can use client-side filtering over a static index (the
  registry isn't large enough to need a server yet).
- Saved searches / favorites — return to this once the URL-state foundation is solid.
- Tag-based filtering beyond the locked facets above (vendor tags, language tags) — extend in v2.
- Bulk actions (compare selected, export) — v2.

## Dependencies

- **Project 00 — Foundation** (NavBar, SubNav, theme, StatusPill, TypeStripe, Card primitive).
- **URL contract** — must be agreed before Project 02 (ecosystem landing) can wire the
  pipeline-anatomy stages to filter deep-links. Pin this in code as a shared `listFilters`
  parser/serializer.

## Tasks

1. **`listFilters` parser/serializer** — first thing to land. Single source of truth for converting
   `URLSearchParams` ↔ a typed `ListFilters` object. Used by both the list page and the
   ecosystem-landing pipeline-anatomy deep links.
2. **FacetPanel component** — sticky on desktop, drawer on mobile. Composes the five facets below.
3. **Facet primitives** — `<CheckboxFacet>` (multi-select with counts), `<RadioFacet>`
   (single-select), `<SearchFacet>` (debounced text input), `<SelectFacet>` (dropdown).
4. **ActiveFilterChips component** — reads from the parsed `ListFilters` and renders dismissible
   chips + "Clear all".
5. **DensityToggle component** — three-state toggle (Cards / Compact / Table). Persist last choice
   to `localStorage`.
6. **SortDropdown component** — three sort options, persisted to URL.
7. **CompactRow component** — default density. Uses the foundation TypeStripe + StatusPill.
8. **CardView component** — Cards density.
9. **TableView component** — Table density. Sortable column headers (which also update the URL).
10. **Pagination component** — simple Bootstrap-style pagination at 50/page. (Add virtualization
    later if perf demands.)
11. **Empty state** — when filters return zero results: explain what's filtering them out and offer
    "Clear all".
12. **List route** — `/<ecosystem>/components` parameterized by ecosystem slug; reads filters from
    URL, fetches the registry slice, renders the chosen density.
13. **Tests** — round-trip filter URL → state → render; ensure pipeline-anatomy deep links from
    Project 02 hit the right filter state; visual regression on each density.

## Acceptance criteria

- Pasting a URL like
  `?type=receiver&signal=traces&distribution=contrib&sort=updated&density=compact` reproduces the
  exact same view another user sees.
- Toggling a facet updates the URL without a full reload.
- Active-filter chips are individually dismissible; "Clear all" resets to defaults.
- Density toggle remembers the user's last choice across sessions (`localStorage`).
- Empty state shown when no results, with a clear path to clear filters.
- All three density modes pass contrast + keyboard navigation in both themes.
- The pipeline-anatomy stages from Project 02 successfully deep-link into the right filter state
  (integration test).
- Result count is always accurate and visible above the results.

## Open questions

- Status terminology in the underlying data is currently mixed (`alpha` / `beta` / `development` /
  `unmaintained`). We need to align on one taxonomy before locking the Stability facet — decide and
  document with `ecosystem-registry` maintainers.
- Should the global ⌘K search from the home page also navigate into the list page with a pre-filled
  `?q=` filter, or stay separate?
- Pagination vs. virtualization at v1 scale (200+ Collector components, 187 Java instrumentations) —
  measure and decide; both are fine, virtualization is more work.
- Vendor / scope facet (e.g., AWS, Azure, GCP) — in scope for v1 or v2? The opentelemetry.io
  registry uses this; we likely want it eventually.
