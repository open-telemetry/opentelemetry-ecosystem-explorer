---
title: "Phase 3 — Ecosystem landing pages"
issue: 84
type: plan
phase: 3
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Project 02 — Ecosystem landing pages

Per-ecosystem (Collector, Java Agent, …) overview pages. Orient a user to the project, then funnel
them into the list with sensible default filters.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) (tab:
**Ecosystem landing**) ·
[`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md)

---

## TL;DR

Each ecosystem (Collector first, then Java Agent, then whatever lands next) gets a landing page with
a contextual hero, a "Latest release" delta card, an interactive **Pipeline anatomy diagram** that
doubles as a one-click filter into the list, and three quick-entry cards. The pipeline diagram is
the load-bearing reusable piece — it gets built once and parameterized per ecosystem.

## Goal

A user clicking "OpenTelemetry Collector" from the home page should:

1. Understand what the Collector _is_ in under 10 seconds (without reading prose).
2. See the most recent release at a glance.
3. Be one click away from the right slice of the component list (e.g., "Receivers" or "Exporters
   that emit traces").

## Scope (in)

- **Sub-nav** with breadcrumbs (`Explorer › Ecosystems › Collector`).
- **Cover-block hero** with eyebrow ("Infrastructure · Vendor-agnostic agent"), gradient title, lead
  copy, three CTAs (Browse all → list page, Read overview, GitHub link), and a right-side "Latest
  release" card showing version + delta (`+4 added · 12 changed · 2 deprecated`).
- **Pipeline anatomy diagram** — horizontal stage-counter for the Collector: Receivers → Processors
  → Exporters → Connectors + Extensions. Each stage shows count and short description, and clicking
  it filters the list page by that type. Color stripes match the foundation type-stripe taxonomy.
- **Quick-entry strip** — three cards: "Most-used components", "Core vs. Contrib", "Diff across
  versions →".
- **CNCF callout** + footer (foundation layer).
- **Java Agent variant** — same shell, but the pipeline diagram is replaced by a "categories"
  diagram (HTTP, DB, messaging, frameworks…) appropriate to the agent.

## Out of scope

- A live pipeline simulator (i.e., interactive flow). The anatomy is a counter + filter shortcut for
  v1, not a playground.
- Per-distribution landing pages (`collector-core` vs. `collector-contrib`) — the contrib/core split
  is handled inside the list page facets.
- Embedded changelog / blog posts on the landing page — link out to the docs/blog instead.
- Vendor pages (the home page already links to `/ecosystem/vendors/` on opentelemetry.io).

## Dependencies

- **Project 00 — Foundation** (NavBar, SubNav, theme system, StatusPill, Card primitive).
- **Project 03 — List page** (the filter URL contract). The pipeline-anatomy stages need to know how
  to deep-link into the filtered list. The two projects can be built in parallel once the URL
  contract is agreed (ideally as a shared spec).

## Tasks

1. **Hero (CoverBlock variant)** — extends the home-page CoverBlock with an eyebrow + right-side
   slot for the release card.
2. **ReleaseCard component** — props: version, releaseDate, deltas (added, changed, deprecated).
   Lives top-right of the ecosystem hero.
3. **PipelineAnatomy component** — array-driven
   (`stages: [{type, count, description, filterHref}]`). Renders horizontal stage cards with arrow
   separators on desktop, vertical stack on mobile. Each stage is a deep-link into the list page.
4. **QuickEntryRow component** — three cards with a configurable list of entries.
5. **/ecosystems/collector route** — composes the above with Collector-specific config.
6. **/ecosystems/java-agent route** — composes the above with Java-Agent-specific config; the
   PipelineAnatomy is swapped for an alternate "categories" diagram.
7. **Per-ecosystem config schema** — TypeScript types for `EcosystemConfig` (hero copy,
   release-fetch source, pipeline stages, quick-entry items). Future ecosystems plug into this
   schema.
8. **Release-data integration** — read latest version + deltas from `ecosystem-registry` /
   `ecosystem-automation` (see open questions). Fall back to a static config if data is missing.
9. **Empty/error states** — graceful render when release data is unavailable.
10. **Visual regression** — snapshot landing pages in both themes.

## Acceptance criteria

- Pipeline anatomy renders for Collector (Receivers, Processors, Exporters, Connectors, Extensions)
  with correct counts.
- Each pipeline stage links to the list page with the matching type filter pre-applied (URL contract
  verified by integration test).
- Java Agent landing renders the alternate categories diagram without code changes outside its
  config.
- "Latest release" card reflects the actual most-recent version when the data source is available;
  renders an empty state otherwise.
- Both themes pass contrast.
- Adding a new ecosystem (e.g., Python) requires only writing a new `EcosystemConfig` and dropping
  in a new route — no per-page component duplication.

## Open questions

- Is the release-delta data (`+4 added · 12 changed · 2 deprecated`) computable from
  `ecosystem-registry` today, or does the data pipeline need to expose this first?
- For the Java Agent "categories" diagram, what's the canonical list of categories? Pull from agent
  docs or curate?
- Should the "Compare versions →" quick-entry card be enabled in v1 (depends on Project 04's diff
  view) or stubbed?
- Hero eyebrow copy — committee-approved short descriptions per ecosystem, or maintainer-owned?
