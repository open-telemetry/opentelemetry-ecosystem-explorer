# Design System (v1 redesign)

This document captures the as-built v1 design system for the OpenTelemetry Ecosystem Explorer
redesign tracked under
[issue #84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84). It runs
in parallel with `DESIGN.md`, which still describes the **legacy** dark-first explorer. The legacy
chrome remains in production until the redesign cleanup PR (PR 8, end of Phase 5) ships, so both
documents are intentionally side-by-side.

When PR 8 lands, this file is **renamed to `DESIGN.md`** (replacing the legacy doc) and the legacy
`DESIGN.md` is deleted. Until then, treat this file as the source of truth for everything that lives
under the `V1_REDESIGN` feature flag in `src/v1/`.

## Status

**Shipped (Phase 1 — Foundation, complete 2026-05-19):**

- Theme system with light / dark / auto switching, `localStorage["td-color-theme"]` persistence, and
  a no-flash init script in `index.html`.
- v1 chrome — `<NavBar />`, `<SubNav />`, `<FooterV1 />`, `<CncfCallout />`, and a 3-option Radix
  dropdown `<ThemeToggle />` — all mirroring opentelemetry.io upstream styles.
- Shared primitives — `<StatusPill>` (six OTel stability levels), `<TypeStripe>` (five collector
  component types), `<DetailCard>` with optional `typeStripe` slot.
- `.v1-app` scoping pattern that lets v1 surface tokens override the legacy palette without leaking
  outside `<V1App />`.
- `/_dev/components` showcase route (gated by `DEV_SHOWCASE`) and a Playwright + axe-core baseline
  captured by `screenshots-baseline.yml`.

**Coming next:** Phase 2 starts with PR 1 — `<CoverBlock>` + `<HomeV1 />` shell + the `/` route
swap. Subsequent PRs slot real components into the skeleton sections. For the rolling roadmap, phase
plans, and decision log, see
[`projects/84-ui-ux-design/NEXT-STEPS.md`](../projects/84-ui-ux-design/NEXT-STEPS.md).

---

## Overview

The v1 system is **opentelemetry.io-aligned**: navbar, footer, theme toggle, and brand colors mirror
the upstream site so the explorer reads as a sub-product, not a separate microsite. Inside that
chrome the explorer ships its own content, components, and interactions — only the **shared chrome**
tracks upstream.

The system emphasizes:

- **Light + dark parity** — every surface, primitive, and chrome component renders in both themes;
  WCAG AA contrast is a non-negotiable in both.
- **Token-driven theming** — colors flow through HSL custom properties in `src/styles/tokens.css`
  and `src/v1/styles/tokens.css`; consumers never hardcode hexes.
- **Scoped overrides** — v1-only behavior lives under `src/v1/` and is scoped via the `.v1-app`
  class so it stays inert in the legacy bundle.
- **Upstream fidelity for chrome** — navbar, footer, theme-toggle, and CncfCallout styles are
  pixel-anchored to opentelemetry.io's Bootstrap + Docsy source.

---

## Design Principles

### 1. Light + dark first

Both themes are first-class. The user picks via a 3-option dropdown (Light / Dark / Auto); `auto`
follows `prefers-color-scheme`. The resolved theme is written to `<html data-theme="...">` and every
component reads tokens that flip via `[data-theme]` blocks in `src/styles/tokens.css`.

Components must verify in both themes before shipping. The visual-regression baseline (#487)
snapshots each primitive in light and dark on the `/_dev/components` showcase route.

### 2. opentelemetry.io alignment for chrome

Navbar, footer, theme toggle, and CncfCallout track upstream opentelemetry.io styles verbatim.
Metrics, hover behaviors, and surface colors come from the local clone at
`/Users/vasconcellos/projetos/opentelemetry/opentelemetry.io` (see `CLAUDE.local.md`). The
explorer's `.td-navbar`, `.td-footer`, `.td-light-dark-menu__*` selectors mirror their upstream SCSS
counterparts.

The chrome's **styles** track upstream; the chrome's **link list** is explorer-specific (today the
navbar has a single `Docs` link; new explorer-scoped links land here, not on opentelemetry.io).

### 3. Explorer-specific content

Inside the chrome, the explorer composes its own pages. Search behavior, list layouts, detail pages,
and ecosystem-landing pages diverge from opentelemetry.io — they're built for the explorer's catalog
use case. Components like `<CoverBlock>`, `<TypeStripe>`, and `<StatusPill>` have no upstream
equivalent.

### 4. Accessibility is non-negotiable

Every primitive ships with semantic HTML, ARIA where semantic HTML isn't enough, keyboard support,
and WCAG AA contrast in both themes. See `ecosystem-explorer/AGENTS.md` for the full rules (toggle
buttons need `aria-pressed`, icon-only buttons need `aria-label`, etc.). The `/_dev/components`
route runs axe-core against every primitive in both themes.

### 5. Token-driven theming

No hardcoded hexes outside `src/styles/tokens.css` and `src/v1/styles/tokens.css`. Brand primitives
(`--otel-blue-hsl`, `--otel-orange-hsl`, `--otel-purple-hsl`) stay constant across themes; surface
tokens (`--background-hsl`, `--card-hsl`, `--border-hsl`, etc.) flip per theme. Always-dark surfaces
like the navbar use theme-invariant tokens declared on `:root`.

---

## Theme System

The theme attribute is written to `<html>` and read by every `[data-theme]` rule in the stylesheet.

### Wiring

- `index.html` ships an inline init script that reads `localStorage["td-color-theme"]` (or falls
  back to `matchMedia("(prefers-color-scheme: dark)")`) and sets `<html data-theme>` synchronously
  before React mounts. This is the no-flash guarantee — body bg paints correctly on first frame.
- `src/theme-context.tsx` defines `ThemeProvider`, which exposes `{ mode, resolved, setMode }`:
  - `mode` — the user's stored preference (`"light" | "dark" | "auto"`).
  - `resolved` — what's actually applied (`"light" | "dark"`); `auto` resolves via
    `useSyncExternalStore`.
  - `setMode` — writes to state, persists to `localStorage`, and the effect rewrites `data-theme`.
- `src/v1/components/ui/theme-toggle.tsx` renders a 3-option Radix dropdown (`Light` / `Dark` /
  `Auto`) mirroring opentelemetry.io's `theme-toggler.html`. The trigger icon reflects the current
  `mode`; the active row is signaled by background color, not a checkmark (matches upstream).

### Storage contract

| Key                 | Values                        | Owner                  |
| ------------------- | ----------------------------- | ---------------------- |
| `td-color-theme`    | `"light" \| "dark" \| "auto"` | `ThemeProvider`        |
| `<html data-theme>` | `"light" \| "dark"`           | `ThemeProvider` + init |

The storage key is intentionally `td-color-theme` (not `data-bs-theme`) — see the 2026-05-06
decision row in `NEXT-STEPS.md`: opentelemetry.io uses `data-bs-theme` because Hugo Docsy is
Bootstrap-based, but the explorer is on Tailwind v4 with no Bootstrap. Visual alignment is driven by
colors and layout, not the attribute name.

---

## Color and Token System

All colors flow through HSL custom properties in `src/styles/tokens.css`. The system has three
layers:

### Brand primitives — stable across themes

```css
--otel-blue-hsl: 228 37% 49%;
--otel-orange-hsl: 41 100% 48%;
--otel-purple-hsl: 230 38% 49%; /* lands in PR 1 of Phase 2; canonical from here on */
```

These map directly to opentelemetry.io's `$primary` / `$secondary` / `$tertiary` SCSS variables.
**Brand primitives never swap between themes** — orange stays orange, blue stays blue. SVG
illustrations and ornamental gradients reference these directly so hue intent is preserved.

### Semantic role tokens — pluggable

```css
--primary-hsl: var(--otel-blue-hsl); /* structural / navbar / buttons */
--secondary-hsl: var(--otel-orange-hsl); /* accents / hover / CTAs */
--hero-accent-hsl: var(--otel-orange-hsl);
--hero-accent-alt-hsl: var(--otel-blue-hsl);
```

Interactive UI chrome (focus rings, hover borders, CTAs) reads role tokens so the chrome can be
rebranded without touching every consumer. The `--hero-accent-*` pair flips between themes — dark
mode runs orange-dominant, light mode runs blue-dominant.

### Surface tokens — theme-dependent

```css
/* Dark (default) */
--background-hsl: 232 38% 15%;
--foreground-hsl: 210 17% 98%;
--card-hsl: 232 35% 19%;
--card-secondary-hsl: 232 32% 23%;
--muted-hsl: 232 28% 22%;
--muted-foreground-hsl: 220 14% 65%;
--border-hsl: 232 22% 28%;
```

The `[data-theme="light"]` block in `src/styles/tokens.css` redeclares the surface block with a
light palette (`--background-hsl: 0 0% 100%`, `--foreground-hsl: 220 13% 15%`, etc.). Brand
primitives stay constant in both blocks.

### Theme-invariant chrome tokens

The navbar surface stays dark in both themes (mirrors opentelemetry.io's
`shade-color($primary, 22%)`). These tokens live on `:root` so they're never rewritten by
`[data-theme]`:

```css
--navbar-bg-hsl: 228 38% 38%; /* #3d4c86 */
--navbar-fg-hsl: 210 17% 98%; /* gray-100 */
--navbar-accent-hsl: var(--otel-orange-hsl);
```

Same pattern applies to the footer (always dark, hardcoded `#212529` matches Docsy's
`.td-box--dark`) and the CncfCallout (always purple, will read `--otel-purple-hsl` after the Phase 2
PR 1 token consolidation).

### Tailwind binding

The `@theme` block in `src/styles/index.css` wraps each `--*-hsl` triplet in `hsl(...)` to produce
the Tailwind utility classes (`bg-primary`, `text-foreground`, `border-border`, etc.). Tailwind v4
is the only preprocessor — no SCSS — and Lightning CSS inlines `@import`s at build time.

---

## Scoping: `.v1-app` and `data-theme`

v1 introduces a second axis of scoping on top of `data-theme`. The class lives in two places:

1. **On `<html>`** — set synchronously by the carve-out in `src/main.tsx` when `V1_REDESIGN` is on.
   This is the **only** flag read outside the `App.tsx` boundary, and it exists so the body
   background paints against v1 surface tokens from the first frame. Without it, body would flash
   the legacy navy palette during the React mount window.
2. **On `<V1App />`'s wrapper `<div>`** — applied by `src/v1/V1App.tsx` for nested cascade scoping
   inside the React tree.

The v1 surface-token override in `src/v1/styles/tokens.css` needs both selectors to win:

```css
.v1-app {
  --background-hsl: 210 11% 15%; /* #212529 — Bootstrap $dark */
  --foreground-hsl: 210 11% 88%; /* #dee2e6 */
}

[data-theme="light"].v1-app,        /* matches <html> when both attrs sit on the same element */
[data-theme="light"] .v1-app {
  /* matches the wrapper <div> as a descendant of light-themed html */
  --background-hsl: 0 0% 100%;
  --foreground-hsl: 210 11% 15%;
}
```

The pair pattern is load-bearing because the body element lives **outside** `<V1App />`'s wrapper
subtree, so the cascade only reaches body when `.v1-app` is on `<html>`. The wrapper-div copy exists
for components rendered inside the React tree (Radix portals back to `<body>`, but their ancestor
chain still includes `<html>`).

Other surface tokens (`--card-hsl`, `--muted-hsl`, `--border-hsl`) stay on the explorer's legacy
palette for now and move per-page as Phase 2-5 redesigns each route.

PR 8 cleanup removes both the `main.tsx` carve-out and the App.tsx boundary read.

---

## Chrome Components

All chrome lives under `src/v1/components/layout/` with CSS partials in `src/v1/styles/`. Selector
prefixes mirror upstream: `.td-navbar`, `.td-subnav`, `.td-footer`, `.td-cncf-callout`,
`.td-light-dark-menu__*`. Only elements rendered by `<V1App />` match these selectors, so the chrome
is inert in the legacy bundle.

### NavBar

`src/v1/components/layout/nav-bar.tsx` + `src/v1/styles/navbar.css`.

- Markup mirrors `themes/docsy/layouts/_partials/navbar.html` upstream.
- Surface is `--navbar-bg-hsl` (always dark, theme-invariant).
- Logo lockup uses `<OpenTelemetryWordmark />` (the upstream SVG with mark + wordmark in one piece),
  white via `currentColor`, 48px tall.
- Right-aligned nav-scroll via `margin-left: auto` on `.td-navbar-collapse` at md+.
- Single `Docs` link → `https://opentelemetry.io/docs/`. The link list is **explorer-specific** and
  will grow with the explorer's needs — it does not track upstream's full nav.
- Theme-toggle dropdown sits inside the nav-scroll, picking up the shared hover underline.
- Hover renders a 3px orange underline at `0.5em` offset; active links sit at `0.375em`.
- Mobile (< 768px) collapses behind a hamburger toggle into an overlay panel with a 0.5-opacity
  backdrop. Escape closes the panel.
- Pixel-anchored at 16px-rem inside `.td-navbar` to neutralize the explorer's global
  `html { font-size: 14px }`.

### SubNav

`src/v1/components/layout/sub-nav.tsx` + `src/v1/styles/sub-nav.css`.

- Breadcrumb row that sits beneath the navbar on inner pages. Renders nothing if both `crumbs` and
  `actions` are empty so callers can mount it unconditionally.
- API: `crumbs: BreadcrumbItem[]` (where each item is `{ label, href? }`) plus an optional `actions`
  slot for page-level controls (filter toggles, "Edit on GitHub", etc.).
- Last crumb is the current page — rendered as a styled `<span>` with `aria-current="page"`.
- Surface reads `--card-hsl` and `--border-hsl`, so the row flips with the page theme.
- Max-width is `1320px` matching the footer and the CNCF band.

### FooterV1

`src/v1/components/layout/footer.tsx` + `src/v1/styles/footer.css`.

- Mirrors opentelemetry.io's `.td-footer` (`themes/docsy/assets/scss/td/_footer.scss` +
  `themes/docsy/layouts/_partials/footer.html`).
- Surface is hardcoded `#212529` (`.td-box--dark`) — stays dark in both themes; upstream extends
  `.td-footer @extend .td-box--dark` regardless of `data-bs-theme`. See the 2026-05-14 decision row
  in `NEXT-STEPS.md`.
- 3-column grid layout (`left` / `center` / `right`) above 576px; 2x2 stacked below.
- Link inventory locked verbatim against the upstream `config/_default/hugo.yaml` — 7 user-facing
  links on the left, 7 developer-facing on the right, copyright in the center.
- Hover uses OTel orange (`#f5a800`), a small deviation from Docsy's auto-mixed blue.
- Brand icons (Bluesky, GitHub, Mastodon, Slack, Stack Overflow, Trademark) are inline SVGs from
  `src/v1/components/icons/` — Lucide v1.x dropped brand glyphs for licensing reasons. Lucide is
  used for everything else (Mail, Book, Image, etc.).
- Max-width 1320px matches `.td-cncf-callout__container` and Bootstrap's `.container-xxl`.

### CncfCallout

`src/v1/components/layout/cncf-callout.tsx` + `src/v1/styles/cncf-callout.css`.

- Explorer-original chrome — no upstream opentelemetry.io equivalent.
- Sits between `<main>` and `<FooterV1 />` on every v1 route.
- Surface is OTel purple via `hsl(var(--otel-purple-hsl))` per the design brief —
  `td-box--secondary`. The `--otel-purple-hsl` primitive is theme-invariant and lives in
  `src/styles/tokens.css`.
- Centered single-column layout: lead text → CNCF wordmark.
- CNCF wordmark is `<CncfLogo />` in `src/v1/components/icons/`, inlining the upstream
  `static/img/logos/cncf-white.svg`.

---

## Shared Primitives

Primitives live in `src/components/ui/` (not under `src/v1/`) per the routing pivot — both sub-apps
can consume them, and PR 8 cleanup deletes only the legacy chrome, not the primitives.

### StatusPill

`src/components/ui/status-pill.tsx`.

Six OTel stability levels mapped to GlowBadge variants:

| Stability      | Variant     | Visual      |
| -------------- | ----------- | ----------- |
| `development`  | `secondary` | Gray, muted |
| `alpha`        | `warning`   | Orange      |
| `beta`         | `info`      | Blue        |
| `stable`       | `success`   | Green       |
| `deprecated`   | `error`     | Red         |
| `unmaintained` | `error`     | Red         |

Terminology follows the
[OTel collector stability spec](https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md)
so anyone reading both sources sees the same terms. The legacy `<StabilityBadge>` is left untouched
in Phase 1 — a follow-up cleanup PR migrates the Java configuration builder to `<StatusPill>`.

### TypeStripe

`src/components/ui/type-stripe.tsx` + `src/components/ui/type-stripe-colors.ts`.

4px left-edge color stripe flagging the OTel-collector component type. Five canonical types:

| Type        | Color (HSL)   |
| ----------- | ------------- |
| `receiver`  | `200 85% 45%` |
| `processor` | `270 70% 55%` |
| `exporter`  | `38 95% 52%`  |
| `connector` | `330 75% 50%` |
| `extension` | `165 70% 40%` |

`CollectorComponentType` is derived from `CollectorComponent["type"]` in `src/types/collector.ts` —
the registry data is the canonical source of truth, the stripe primitive just consumes it. (Renamed
from `ComponentType` in the 2026-05-14 cleanup to avoid shadowing React's `ComponentType<P>`.)

The color map lives in a separate file so React Fast Refresh stays happy
(`react-refresh/only-export-components` disallows constants alongside component exports).

The stripe is decorative — it carries `aria-hidden`. List rows and cards that use a stripe must
expose the component type through the surrounding markup (heading, label) for screen readers.

### DetailCard

`src/components/ui/detail-card.tsx`.

General-purpose card wrapper with an optional `typeStripe` slot:

```tsx
<DetailCard typeStripe="receiver" withGrid withHoverEffect>
  {children}
</DetailCard>
```

When `typeStripe` is set, DetailCard mounts `<TypeStripe>` with absolute-positioning classes so the
stripe renders once and the rendering path stays in one place. Other slots:

- `withGrid` — adds an SVG grid pattern overlay at 10% opacity.
- `withHoverEffect` — lift on hover with shadow + border-color transition.

DetailCard was chosen over NavigationCard (per the 2026-05-06 decision row): DetailCard is a
general-purpose wrapper (`children` + `className` passthrough), so adding a `typeStripe` prop is a
clean fit. NavigationCard is specialized (hardcoded icon box, arrow, corner accent); restructuring
it for the stripe slot wasn't worth the churn.

### GlowBadge

`src/components/ui/glow-badge.tsx`.

Foundational badge with seven variants: `accent` / `secondary` / `success` / `info` / `warning` /
`error` / `muted`. Optional `withGlow` adds a soft shadow in the variant color. Used directly by
StatusPill and reused freely for other categorical indicators.

---

## Surface Patterns

### Page background

`<body>` reads `hsl(var(--background-hsl))` via `src/styles/base.css`. Inside `<V1App />`, the
`.v1-app` override redirects this to the Bootstrap-aligned `#212529` / `#fff` pair. Pages don't set
their own background — they inherit from the wrapper.

### Layering

The legacy system's depth-through-subtlety layering carries over (background → pattern → content →
overlay), but the chrome adds two new hard layers above:

1. **Navbar** — `position: fixed`, `z-index: 32`, always dark. Page content sits behind a 64px
   reserved top padding (or 104px on mobile).
2. **CncfCallout + FooterV1** — sticky-to-bottom in the flex column, always dark/purple
   respectively.

### Cards and muted surfaces

`bg-card`, `bg-muted`, `border-border` work the same as the legacy system — they read the same HSL
tokens, which now flip per theme. Hover patterns from `DESIGN.md` (`hover:bg-card-secondary`,
`hover:shadow-[0_0_20px_hsl(var(--primary-hsl)/0.1)]`) work identically in v1.

### Cover block (forward — Phase 2 PR 1)

A reusable hero shipping in Phase 2 PR 1: linear gradient base + two radial glows (orange +
purple) + an inline-SVG grid-pattern overlay, all pure CSS. The block self-scopes dark via
`--cover-block-*` tokens (not `--background-hsl`), and the light-theme override declares the same
values — symmetric contract, no implicit fallthrough. See the 2026-05-19 decision rows in
`NEXT-STEPS.md` for the locked treatment.

---

## Animations

Inherits the legacy timing system unchanged:

```css
ease-out     /* element entering — 200ms */
ease-in-out  /* default — 300ms */
ease-in      /* element exiting — 200ms */
```

Chrome-specific motion in v1:

- **Navbar mobile panel** — 180ms `ease` on `opacity` + `transform`, plus a synchronized
  `visibility` step so the panel becomes inert after it animates out.
- **Theme toggle** — Radix handles open/close; no custom transitions.
- **Reduced motion** — `prefers-reduced-motion: reduce` collapses the mobile-panel animations to
  instant state changes (see `src/v1/styles/navbar.css`).

Component-level hover transitions (`transition-all duration-300`,
`transition-transform duration-200`, etc.) follow the legacy patterns from `DESIGN.md`.

---

## Typography

v1 inherits the legacy typography scale. The explorer sets `html { font-size: 14px }` globally in
`src/styles/base.css`, so Tailwind's rem-based sizes (`text-xs` through `text-4xl`) scale
proportionally.

Chrome partials override this to 16px-rem (`.td-navbar`, `.td-subnav`, `.td-footer`,
`.td-cncf-callout` all carry `font-size: 16px`) so they match opentelemetry.io's metrics exactly
without rem-scaling guesswork. Within those subtrees, `em` and `rem` resolve as upstream designed.

Font stack stays at `system-ui, -apple-system, sans-serif` — no custom typeface.

Weight conventions follow the legacy doc:

- `font-normal` (400) — body.
- `font-medium` (500) — emphasized text, labels.
- `font-semibold` (600) — subheadings, buttons, nav links.
- `font-bold` (700) — primary headings.

---

## Spacing

Tailwind's spacing scale, same as legacy:

- **Micro** — `gap-1` (4px), `gap-2` (8px).
- **Component** — `gap-4` (16px), `gap-6` (24px).
- **Section** — `py-8` (32px), `py-12` (48px), `py-16` (64px).
- **Container** — `px-4` (16px), `md:px-8` (32px).

Chrome partials pin specific values rather than using Tailwind classes (e.g., navbar container
`padding: 0 24px`, footer `padding-top: 3rem`) so they stay aligned with upstream.

---

## Grid and Container Widths

- **Chrome max-width** — `1320px` (matches Bootstrap's `.container-xxl`). Used by navbar container,
  footer container, CncfCallout container, and SubNav container.
- **Page content** — pages set their own max-width per layout. Tailwind's `max-w-4xl` / `max-w-6xl`
  / `max-w-7xl` are the common values from legacy patterns.

Grid pattern overlays carry over from `DESIGN.md` — 20px or 40px linear-gradient grids at 10-20%
opacity using `--border-hsl`.

---

## Accessibility

Binding rules live in `ecosystem-explorer/AGENTS.md`. Summary for v1-specific commitments:

- **WCAG AA in both themes.** Light mode is not an afterthought — contrast is verified for every
  primitive in both themes during review and via axe-core on the showcase route.
- **Semantic HTML for chrome.** `<header className="td-navbar">`, `<nav aria-label="Primary">`,
  `<nav aria-label="Breadcrumb">`, `<footer className="td-footer">`, `<section aria-labelledby>` on
  CncfCallout.
- **`aria-pressed` on toggle buttons** (filter buttons, favorite buttons). The theme toggle is a
  Radix dropdown, not a toggle button — it carries `aria-label` describing the active mode.
- **`aria-current="page"`** on the last breadcrumb in `<SubNav>`.
- **`aria-hidden`** on decorative SVGs and the TypeStripe span — surrounding markup must carry the
  semantic meaning.
- **Focus management.** Navbar mobile panel restores `outline: revert` so focus rings come back even
  when Bootstrap-style resets remove them.
- **Keyboard support.** Mobile nav panel closes on Escape; theme-toggle Radix dropdown handles
  Arrow + Enter + Escape natively.

The visual-regression baseline runs axe-core against every primitive in the showcase route — see the
next section.

---

## Visual Regression Baseline

PR 7 (#487) added a Playwright + axe-core baseline that snapshots every primitive in light and dark.

- **Route** — `/_dev/components` (component: `src/v1/features/_dev/components-page.tsx`).
- **Flag** — `DEV_SHOWCASE`. Off in production; the screenshot CI builds enable it. Production users
  can't reach the showcase.
- **Workflow** — `screenshots-baseline.yml` captures the main-branch baseline; every PR diffs
  against it and posts results to the PR comment.
- **Policy** — **diffs are informational, not CI-gating** (confirmed 2026-05-19). Threshold tuning
  is per-PR, not enforced by the workflow.

When adding a new primitive, register it on the showcase route with both theme renders. Phase 2 PR 1
adds `<CoverBlock>` in two variants (title-only and title+aside) to exercise both shapes Phases 2/3
will use; `<HomeV1 />` is covered by the real `/` snapshot after the route swap.

---

## Examples

### Theme-aware component

```tsx
// Reads --background-hsl and --foreground-hsl via Tailwind utility classes;
// both flip per theme automatically.
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card text-foreground border-border rounded-lg border p-6">{children}</div>
  );
}
```

### Brand-primitive usage in CSS

```css
/* Decorative gradient — pin to literal hue intent, ignore theme. */
.hero-glow {
  background: radial-gradient(hsl(var(--otel-orange-hsl) / 0.25), transparent 70%);
}

/* Interactive chrome — track whichever hue plays the structural role. */
.cta-button {
  background-color: hsl(var(--primary-hsl));
  color: #fff;
}
```

### StatusPill consumption

```tsx
import { StatusPill } from "@/components/ui/status-pill";

<StatusPill stability="beta" />
<StatusPill stability="stable" className="ml-2" />
```

### TypeStripe + DetailCard composition

```tsx
import { DetailCard } from "@/components/ui/detail-card";

<DetailCard typeStripe="receiver" withHoverEffect>
  <h3 className="text-foreground text-lg font-semibold">otlphttp</h3>
  <p className="text-muted-foreground text-sm">Receives OTLP-formatted telemetry over HTTP.</p>
</DetailCard>;
```

For a standalone stripe (e.g., compact list rows that don't use DetailCard):

```tsx
import { TypeStripe } from "@/components/ui/type-stripe";

<li className="relative pl-4">
  <TypeStripe type="exporter" className="absolute inset-y-0 left-0 w-1" />
  <span className="text-foreground">otlphttp</span>
</li>;
```

---

## Forward — what's coming

Per-phase plans, decisions, and the rolling roadmap live in
[`projects/84-ui-ux-design/NEXT-STEPS.md`](../projects/84-ui-ux-design/NEXT-STEPS.md).

The next major components to land:

| Component               | Phase | PR              | Notes                                                               |
| ----------------------- | ----- | --------------- | ------------------------------------------------------------------- |
| `<CoverBlock>`          | 2     | PR 1 (#371)     | Reusable hero — title + lead + CTAs + optional aside slot.          |
| `<HomeV1 />` shell      | 2     | PR 1            | Wraps CoverBlock + skeleton placeholders for PRs 2-6.               |
| `<GlobalSearch>`        | 2     | PR 2            | Cross-ecosystem ⌘K search inside CoverBlock.                        |
| `<StatsBand>`           | 2     | PR 3            | OTel-purple stats band, synced with opentelemetry.io's numbers.     |
| `<EcosystemsGrid>`      | 2     | PR 4            | Collector / Java Agent + dashed "coming soon" cards.                |
| `<SignalsRow>`          | 2     | PR 5            | Browse-by-signal — Traces · Metrics · Logs · Baggage.               |
| `<RecentActivityRail>`  | 2     | PR 6            | Recent activity feed.                                               |
| Ecosystem landing pages | 3     | per-page PRs    | Pipeline-anatomy diagram, release card, quick-entry strip.          |
| Faceted list page       | 4     | per-PR slices   | Hard dependency on StatusPill (PR 4) + TypeStripe (PR 5) — shipped. |
| Three-pane detail page  | 5     | PR 04a + PR 04b | PR 04b depends on per-version data exposed by `ecosystem-registry`. |

This file is updated incrementally — each phase's components and patterns land in their relevant
sections as they ship, mirroring how `DESIGN.md` grew over the legacy system's lifetime.

---

## Contributing

When adding new v1 UI components:

1. Follow the design principles above — light + dark parity, token-driven theming, semantic HTML,
   keyboard support, WCAG AA contrast in both themes.
2. Use existing color tokens from `src/styles/tokens.css` and `src/v1/styles/tokens.css`. Don't
   hardcode hexes outside those two files.
3. v1-only components live under `src/v1/`; shared primitives live in `src/components/ui/`.
4. Chrome components prefix their CSS classes with `.td-` and pin their subtree at `font-size: 16px`
   to match opentelemetry.io's metrics.
5. Register new primitives on `/_dev/components` so the visual-regression baseline covers them in
   both themes.
6. Add or update tests next to the source (`*.test.tsx` for unit, `*.integration.test.tsx` for
   integration). API contracts get semantic assertions; compositions get structural assertions.
7. Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run format` before pushing.
8. Document new patterns in this file under the relevant section. Cross-link to the decision row in
   `NEXT-STEPS.md` when the choice has rationale worth preserving.

---

## Rename plan

This file will be renamed to `DESIGN.md` during the redesign cleanup PR (**PR 8**) at the end of
Phase 5, at which point the legacy `DESIGN.md` is deleted and the v1 chrome becomes the only design
system. Until PR 8 ships, treat `DESIGN.md` as the source of truth for the legacy (production)
explorer and this file as the source of truth for everything under `V1_REDESIGN`.
