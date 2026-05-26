---
title: "Phase 1 — Foundation"
issue: 84
type: plan
phase: 1
status: complete
last_updated: "2026-05-19"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Status (2026-05-19)

**Phase 1 complete.** PRs 0-7 are all merged on `main` and
[#370](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/370) is closed. The
v1 chrome (theme system, NavBar, SubNav, StatusPill, TypeStripe, FooterV1, CncfCallout) is shipping
under the `V1_REDESIGN` flag, and `/_dev/components` is wired up for the visual-regression and a11y
baseline (#487).

PR 8 (cleanup) is the **end-of-redesign cleanup** that bundles all phases' cleanups — it is **not**
Phase-1-scoped and lands after Phase 5. See [`v1-routing-pivot.md`](./v1-routing-pivot.md) "Cutover
model" for what PR 8 includes.

The plan and acceptance criteria below are kept as a historical record of what Phase 1 promised.
Per-PR decisions and scope drift (e.g., the 2026-05-11 navbar minimalisation) are captured inline in
[`NEXT-STEPS.md`](./NEXT-STEPS.md)'s decision log; the audit in
[`00-foundation-audit.md`](./00-foundation-audit.md) captures the as-built delta against this plan.

## Project 00 — Foundation

> Shared building blocks every page reuses. **Land this first** — every other project (home,
> ecosystem landing, list, detail) depends on it.

Tracks: [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)
References: [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) ·
[`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md) ·
[`v1-routing-pivot.md`](./v1-routing-pivot.md) ·
[`ecosystem-explorer/DESIGN_V1.md`](../../ecosystem-explorer/DESIGN_V1.md) (as-built v1 system) ·
[`ecosystem-explorer/DESIGN.md`](../../ecosystem-explorer/DESIGN.md) (legacy, frozen until PR 8)

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
- `<NavBar />` component matching opentelemetry.io's **styling** (always-dark, full-width,
  fixed-position, pixel-anchored to opentelemetry.io's `_navbar.scss`). Link list is
  **explorer-specific** and intentionally diverges from opentelemetry.io's nav — v1 shipped with a
  minimal single "Docs" link + `OtelLogo` brand lockup + `<ThemeToggle />`; future link additions
  are explorer-scoped and tracked separately, not against opentelemetry.io drift. Search input
  deferred (see decision log entry 2026-05-11).
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
3. **NavBar component** — port opentelemetry.io's navbar **styles** (always-dark surface, hover
   underline, sticky/fixed positioning, pixel metrics) into a real component. Link list is
   explorer-specific and may diverge from opentelemetry.io — keep the styles in sync, the links are
   ours. Logo lockup uses the local `OtelLogo` component (per the 2026-05-06 decision). Lives in
   `src/v1/components/layout/`.
4. **SubNav component** — breadcrumb + optional right-aligned actions slot. Lives in
   `src/v1/components/layout/`.
5. **Footer component** — two clusters of Font Awesome social icons + centered copyright
   (`© 2019–present OpenTelemetry Authors · Docs CC BY 4.0 · All Rights Reserved`). Lives in
   `src/v1/components/layout/`.
6. **CncfCallout component** — single-purpose, placed at the bottom of every v1 route via a layout
   wrapper inside `<V1App />`. Lives in `src/v1/components/layout/`.
7. **StatusPill component** — props:
   `stability: 'development' | 'alpha' | 'beta' | 'stable' | 'deprecated' | 'unmaintained'`,
   matching the OTel collector stability spec. Bootstrap-style
   `text-bg-secondary/warning/info/success/danger/danger` classes in our token system. Used
   everywhere stability is shown.
8. **Type-stripe primitive** — exports both a CSS class set and a small
   `<TypeStripe type="receiver|..." />` component for use at the left edge of rows and cards.
9. **Card primitive** — `<Card>` with optional `typeStripe` prop, hover state, dark/light surfaces.
10. **Design system documentation** — document the new v1 tokens and component slots so future
    contributors hit the ground running. Lives at `ecosystem-explorer/DESIGN_V1.md` (added on the
    Phase 2 PR 1 prep branch, 2026-05-19). Cannot edit `DESIGN.md` directly — the legacy site is
    still live in production until PR 8 cleanup, at which point `DESIGN_V1.md` is renamed to
    `DESIGN.md` and the legacy doc is deleted.
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
