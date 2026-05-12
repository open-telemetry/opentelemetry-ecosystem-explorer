---
title: "Phase 2 — Home page"
issue: 84
type: plan
phase: 2
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Project 01 — Home page

The Explorer's front door. Sets the tone, surfaces scale, gives both first-timers and returning
users a fast path forward.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) (tab:
**Home**) · [`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md)

---

## TL;DR

Replace the current placeholder home (two cards on a vast empty canvas) with a layout that mirrors
opentelemetry.io's home structure: a `td-cover-block` hero with global search, the OTel-purple stats
band using canonical numbers ("12+ · 200+ · 1005+ · 102+"), an ecosystems grid, a "browse by signal"
section (Traces · Metrics · Logs · Baggage), and a "recent activity" rail.

## Goal

In five seconds a visitor should be able to answer:

1. What is this site?
2. How big is the dataset?
3. Where do I go next (search, ecosystem, signal)?

A returning user should land directly on the ⌘K search or the recent activity feed.

## Scope (in)

- **Hero (cover-block)**: dark-overlay background with radial gradient + grid pattern, OTel logo
  mark, gradient headline ("OpenTelemetry **Ecosystem Explorer**"), short description, primary CTA
  (`btn-lg` orange), secondary CTA (outline-light "Read overview").
- **Global search**: glass-effect ⌘K-able input below the hero; placeholder hints ("Search 1,005+
  components, instrumentations, vendors…"); chip suggestions below.
- **Stats band** (`box-primary`, OTel purple): four counters fed from a single source synced with
  opentelemetry.io's canonical numbers.
- **Ecosystems grid**: Collector and Java Agent as primary cards (with stability pill, count, latest
  version, "updated this week"), plus dashed "coming soon" cards for Python · Go · JS · .NET.
- **Browse by signal**: four cards (Traces · Metrics · Logs · Baggage) — note **Baggage**, matching
  opentelemetry.io's signal taxonomy. Not "Profiles".
- **Recent activity rail**: list of the last ~10 events (component
  added/promoted/deprecated/changed) with status pill, ecosystem label, version, and timestamp. Each
  row links to the relevant detail page.
- **CNCF callout** + **footer** (provided by the foundation layer).

## Out of scope

- The actual search backend — wire to a stub that returns canned results, or fall back to
  client-side filtering across a static index. A real search engine is a follow-up.
- Live ingestion of the "recent activity" feed — rely on a periodically-built JSON for v1.
- Personalization (e.g., "your favorites").
- Multi-language localization beyond reuse of foundation language dropdown.

## Dependencies

- **Project 00 — Foundation** (theme system, NavBar, Footer, CncfCallout, StatusPill, Card
  primitive).

## Tasks

1. **Hero/CoverBlock component** — reusable across home and ecosystem landing. Props: title,
   subtitle, CTAs, optional right-side content slot.
2. **GlobalSearch component** — controlled input with ⌘K shortcut binding, suggestion chips, results
   dropdown (initially stubbed). Persist last-used query in `sessionStorage`.
3. **StatsBand component** — four-column grid; numbers and labels driven by a config file. Land that
   file with the canonical numbers and a comment pointing to the opentelemetry.io page that
   publishes them. Keep the file small so future updates are a one-liner.
4. **EcosystemsGrid component** — accepts an ordered list of ecosystems with metadata (icon, name,
   stability, count, latest version, weekly delta). Two prominent + four "coming soon" placeholders
   for v1.
5. **SignalsRow component** — four signal cards. Use the `Traces · Metrics · Logs · Baggage` set to
   match opentelemetry.io. Each links to a future cross-ecosystem signal-filter URL (placeholder OK
   for v1).
6. **RecentActivityRail component** — consumes a `GET /activity.json` (or similar) feed. Group by
   recency (last 7 / last 30 days). Each row is a link to a detail page.
7. **Home route** — composes the above in order: hero → search → stats → ecosystems → signals +
   activity → CNCF callout.
8. **Empty / loading states** for the recent-activity feed (foundation has the empty-state pattern).
9. **Tests** — visual regression on hero + stats; unit tests on ⌘K binding; integration test that
   clicking a stat link goes to the right route.

## Acceptance criteria

- Above-the-fold (hero + search) is fully usable with no scroll on a 1280×800 viewport.
- ⌘K (or Ctrl+K on non-Mac) focuses the global search.
- Stats band reads exactly: `12+ Languages`, `200+ Collector Components`, `1005+ Integrations`,
  `102+ Vendors` (or whatever the canonical config says — verifiable against opentelemetry.io).
- Light and dark themes both pass contrast in every section.
- Clicking a signal card navigates to the right cross-ecosystem filter URL (even if the destination
  page is a placeholder for v1).
- Clicking a stat number navigates to the relevant doc (`12+` → languages page, `200+` → collector
  components list, etc.).
- "Coming soon" ecosystem cards render but are not links (or are links to a join-the-effort page).

## Open questions

- Does the global search actually search across ecosystems, or just narrow within the current one?
  (The brief proposes cross-ecosystem; we should confirm scope before building the index.)
- Is there an existing `activity.json` or similar in `ecosystem-automation`, or do we need to
  generate one as part of this project?
- Hero bg image: lifted from opentelemetry.io's home, our own version, or pure CSS gradient (current
  mockup)?
