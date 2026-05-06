---
title: "Phase 1 — Foundation"
issue: 84
type: plan
phase: 1
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Project 00 — Foundation

> Shared building blocks every page reuses. **Land this first** — every other project (home,
> ecosystem landing, list, detail) depends on it.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) ·
[`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md) ·
[`ecosystem-explorer/DESIGN.md`](../../ecosystem-explorer/DESIGN.md)

---

## TL;DR

Port the explorer onto the same visual chrome opentelemetry.io uses: light/dark/auto theme system
(`data-theme` + persisted to `localStorage` under `td-color-theme`), an always-dark Docsy-style
navbar, the two-cluster footer, and the CNCF callout. Lock the canonical color/badge mappings so
every later page can compose against a stable foundation.

## Goal

When a contributor starts the next project (home page), they should be able to drop content into a
`<main>` slot and inherit nav, footer, theme switching, brand colors, status pills, and type stripes
without writing any of that themselves.

## Scope (in)

- Theme system: `data-theme="light|dark"`, persisted to `localStorage` key `td-color-theme`, honors
  `prefers-color-scheme` for the "auto" option, with a navbar toggle. No flash of wrong theme on
  first paint.
- CSS custom properties exposed for both themes (see DESIGN.md "CSS Custom Properties" section).
- `<NavBar />` component matching opentelemetry.io: always-dark, full-width, sticky. Includes logo
  lockup, primary nav (Docs · Ecosystem · Status · Community · Training · Blog · **Explorer**),
  search input (placeholder Ask AI / ⌘K), theme toggle.
- `<SubNav />` component for the explorer (breadcrumb-only on home, breadcrumb + page actions on
  inner pages).
- `<Footer />` component matching opentelemetry.io's two-cluster Font Awesome layout with centered
  copyright.
- `<CncfCallout />` component used at the bottom of every page.
- Locked **status-pill mapping** matching the OTel collector stability spec — six levels:
  `development=secondary`, `alpha=warning`, `beta=info`, `stable=success`, `deprecated=danger`,
  `unmaintained=danger` — as a typed enum + a `<StatusPill stability="..." />` component.
- Locked **type-stripe mapping** (`receiver`, `processor`, `exporter`, `connector`, `extension`) as
  a 4px left-edge stripe primitive that other pages can compose into rows and cards.
- Reusable `<Card />` primitive with the type-stripe slot wired in.

## Out of scope

- Anything page-specific (heroes, search, filters, lists, detail layouts).
- Real data fetching — components can render against fixtures.
- Search infrastructure (the search input in the navbar can be a non-functional decoration for now).

## Dependencies

- None. This is the root.

## Tasks

1. **Theme tokens** — define light + dark CSS custom properties in `src/themes.ts`; switch consumers
   from inline `hsl(var(--color-*))` strings to the new tokens. Verify Tailwind v4 `@theme` config
   plays nicely with `data-theme`.
2. **Theme toggle** — implement a no-flash theme initializer (matches opentelemetry.io's
   `data-theme-init` script) that runs before paint, plus a navbar toggle that cycles light → dark →
   auto and writes to `localStorage["td-color-theme"]`.
3. **NavBar component** — port the navbar HTML/CSS from the mockup into a real component. Confirm
   logo lockup matches opentelemetry.io (linked SVG at
   `/img/logos/opentelemetry-horizontal-color.svg` or our local copy). Sticky, full-width.
4. **SubNav component** — breadcrumb + optional right-aligned actions slot.
5. **Footer component** — two clusters of Font Awesome social icons + centered copyright
   (`© 2019–present OpenTelemetry Authors · Docs CC BY 4.0 · All Rights Reserved`).
6. **CncfCallout component** — single-purpose, placed at the bottom of every route via a layout
   wrapper.
7. **StatusPill component** — props:
   `stability: 'development' | 'alpha' | 'beta' | 'stable' | 'deprecated' | 'unmaintained'`,
   matching the OTel collector stability spec. Bootstrap-style
   `text-bg-secondary/warning/info/success/danger/danger` classes in our token system. Used
   everywhere stability is shown.
8. **Type-stripe primitive** — exports both a CSS class set and a small
   `<TypeStripe type="receiver|..." />` component for use at the left edge of rows and cards.
9. **Card primitive** — `<Card>` with optional `typeStripe` prop, hover state, dark/light surfaces.
10. **DESIGN.md update** — document the new tokens and component slots so future contributors hit
    the ground running.
11. **Visual regression baseline** — Playwright snapshots of NavBar + Footer + StatusPill + Card in
    both themes. Locks the look before later projects start moving things.

## Acceptance criteria

- Theme toggle works without a visible flash on first load.
- Both themes pass WCAG AA contrast on body text and pill text.
- All six `StatusPill` variants render correctly in both themes
  (`development | alpha | beta | stable | deprecated | unmaintained`).
- All five `TypeStripe` variants render correctly.
- The home, landing, list, and detail mockups can be re-skinned to consume these primitives without
  per-page color overrides.
- `localStorage["td-color-theme"]` is set when the toggle is used; reading the same key reproduces
  the chosen theme on a fresh load.
