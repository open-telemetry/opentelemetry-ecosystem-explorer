---
title: "Phase 1 — Foundation: Codebase audit"
issue: 84
type: audit
phase: 1
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Phase 1 — Foundation: Codebase Audit

Companion to [`00-foundation.md`](./00-foundation.md). This is the "state of the explorer today":
what's already in `ecosystem-explorer/src/`, what we can reuse, and the concrete delta per
foundation task before we open the first PR.

---

## TL;DR

The codebase is in **much better shape than the placeholder screenshots suggested**. It's a real
React 19 + TypeScript 6 + Vite 8 + Tailwind v4 app with a feature-organized `src/features/<name>/`
layout, a typed feature-flag system already in production use, a theme provider, an API + IDB cache
layer, and a substantial UI primitive library (`components/ui/*`).

That changes Phase 1 from "build foundation" to **"extend and align an existing foundation"**. Most
of the 11 tasks in `00-foundation.md` already have partial implementations we can build on instead
of replacing.

The migration plan is now concrete: add a `V1_REDESIGN` flag to the existing `lib/feature-flags.ts`
and use the same `isEnabled(...)` pattern that already gates `JAVA_CONFIG_BUILDER` and
`COLLECTOR_PAGE`. No new infrastructure.

---

## Stack snapshot

| Layer         | What's there                                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | React 19, TypeScript 6, Vite 8 (`@vitejs/plugin-react-swc`)                                                                                                                                                          |
| Routing       | `react-router-dom@7` with `BrowserRouter`                                                                                                                                                                            |
| Styling       | Tailwind v4 via `@tailwindcss/postcss`. **No `tailwind.config.*` file** — Tailwind v4 uses an `@theme` block inside `src/index.css`                                                                                  |
| UI primitives | Radix UI (`react-hover-card`, `react-tabs`, `react-tooltip`), Lucide React icons, custom UI library at `src/components/ui/*`                                                                                         |
| Markdown      | `react-markdown` + `remark-gfm`                                                                                                                                                                                      |
| Data          | `idb` (IndexedDB) with custom cache (`lib/api/idb-cache.ts`); typed fetchers per ecosystem (`javaagent-data`, `collector-data`, `configuration-data`); custom `fetch-with-cache`                                     |
| Telemetry     | Grafana Faro (`@grafana/faro-react`, `@grafana/faro-web-tracing`)                                                                                                                                                    |
| Testing       | Vitest 4 (unit, co-located `*.test.tsx`), separate integration suite (`vitest.integration.config.ts`), Testing Library, `fake-indexeddb`, **Playwright 1.59 installed but not yet configured for visual regression** |
| Lint/format   | ESLint 10, Prettier 3 with `prettier-plugin-tailwindcss`                                                                                                                                                             |
| Build         | `tsc -b && vite build`; deployed via Netlify (`netlify-build:preview`, `netlify-build:production`)                                                                                                                   |

## File layout

```text
src/
├── App.tsx                  ← BrowserRouter + Routes; some routes are flag-gated
├── main.tsx                 ← entry; ThemeProvider lives here
├── index.css                ← Tailwind import + @theme block + global styles
├── themes.ts                ← Theme definitions (currently: only "dark-blue")
├── theme-context.tsx        ← React context that injects HSL custom properties
├── faro.ts                  ← Telemetry init
├── components/
│   ├── icons/               ← OtelLogo, GitHubIcon, JavaIcon, CompassIcon, …
│   ├── layout/              ← Header, Footer, PageContainer (CURRENT shell)
│   └── ui/                  ← GlowBadge, StabilityBadge, Tabs, Tooltip, NavigationCard, SegmentedTabs, …
├── features/
│   ├── home/                ← HomePage + HeroSection + ExploreSection
│   ├── collector/           ← CollectorPage + CollectorDetailPage (the broken one)
│   ├── java-agent/          ← Java agent ecosystem (large; has full config builder)
│   ├── about/               ← About page
│   └── not-found/           ← 404
├── hooks/                   ← Data hooks: use-collector-data, use-javaagent-data, use-configuration-data
├── lib/
│   ├── feature-flags.ts     ← Typed flag system (used by App.tsx)
│   ├── api/                 ← Data fetchers + IDB cache
│   └── …                    ← yaml-generator, schema-defaults, validation, etc.
├── types/                   ← Domain types (collector, javaagent, configuration)
└── test/integration/        ← Integration test suite + helpers
```

---

## What we can reuse (don't rebuild)

| Foundation task   | Already exists                                          | Path                                                                         | Status                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme system      | `ThemeProvider` + HSL custom properties                 | `src/theme-context.tsx`, `src/themes.ts`, `src/index.css`                    | **Extend** to support light + dark + auto                                                                                                                                                                                                                                                                                                                                 |
| NavBar            | Sticky header with logo + 2 nav links                   | `src/components/layout/header.tsx`                                           | **Replace** with opentelemetry.io-style navbar (gated by V1_REDESIGN)                                                                                                                                                                                                                                                                                                     |
| Footer            | 3-column footer with OTel branding                      | `src/components/layout/footer.tsx`                                           | **Replace** with two-cluster Docsy-style footer (gated)                                                                                                                                                                                                                                                                                                                   |
| StatusPill        | `<StabilityBadge>` + `<GlowBadge variant="...">`        | `src/components/ui/stability-badge.tsx`, `src/components/ui/glow-badge.tsx`  | **Add new `<StatusPill>` primitive** in PR 4 — covers all six OTel stability levels (development / alpha / beta / stable / deprecated / unmaintained). Leaves `<StabilityBadge>` alone for now; migration is a follow-up cleanup PR after Phase 1. `GlowBadge` gains a `secondary` variant for `development` and an `error/danger` variant for `deprecated/unmaintained`. |
| Card primitive    | `<NavigationCard>`, `<DetailCard>`                      | `src/components/ui/navigation-card.tsx`, `src/components/ui/detail-card.tsx` | **Audit + extend** — see if either is general enough to host the type-stripe slot                                                                                                                                                                                                                                                                                         |
| TypeStripe        | —                                                       | —                                                                            | **New primitive**                                                                                                                                                                                                                                                                                                                                                         |
| CncfCallout       | —                                                       | —                                                                            | **New primitive**                                                                                                                                                                                                                                                                                                                                                         |
| Feature flagging  | `lib/feature-flags.ts` with typed `FEATURE_FLAGS` array | `src/lib/feature-flags.ts`                                                   | **Reuse as-is** — add `V1_REDESIGN` to the array                                                                                                                                                                                                                                                                                                                          |
| OtelLogo          | Local SVG component                                     | `src/components/icons/otel-logo.tsx`                                         | **Reuse as-is** — answers the "logo source" open question                                                                                                                                                                                                                                                                                                                 |
| Visual regression | Playwright installed                                    | `package.json`, no config yet                                                | **Configure** — first time anyone wires it up                                                                                                                                                                                                                                                                                                                             |

## What's incomplete or drifting today

| Issue                                                                                                                                                                                                                                                                                      | Where                                                         | Impact                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Color drift between `index.css` and `themes.ts`.** `index.css` `@layer theme` has cyan values (`--primary-hsl: 185 85% 70%`) but `themes.ts` defines orange (`38 95% 52%`). `ThemeProvider` overwrites the CSS values on mount, but there's a flash of wrong-color-theme on first paint. | `src/index.css` lines 13–30 vs `src/themes.ts` lines 50–67    | Needs reconciling as part of theme work. The CSS defaults should match the default theme so first paint is correct.                       |
| **Single theme.** `ThemeId = "dark-blue"` only — no light, no dark, no auto.                                                                                                                                                                                                               | `src/themes.ts:17`                                            | Foundation task #1 must extend this. Light + dark + auto with `prefers-color-scheme`.                                                     |
| **`data-theme` attribute, not `data-bs-theme`.**                                                                                                                                                                                                                                           | `src/theme-context.tsx:53`                                    | Keeping `data-theme` (decided 2026-05-06, see Q1). The codebase isn't on Bootstrap, so `data-bs-theme` would be misleading.               |
| **`StabilityBadge` only handles `"development"`.** Returns `null` for everything else.                                                                                                                                                                                                     | `src/components/ui/stability-badge.tsx:27`                    | Foundation task #7 needs to extend this OR introduce a separate `<StatusPill>` and migrate `StabilityBadge` callers over time.            |
| **`GlowBadge` missing `error/danger` variant.** Has primary/success/info/warning/muted.                                                                                                                                                                                                    | `src/components/ui/glow-badge.tsx:18`                         | One-line addition.                                                                                                                        |
| **Header has only Java Agent + Collector links.**                                                                                                                                                                                                                                          | `src/components/layout/header.tsx:27–40`                      | The new navbar replaces this entirely. The current Header keeps shipping behind the flag.                                                 |
| **No theme toggle UI anywhere.** `ThemeProvider` exposes `setThemeId` but nothing calls it.                                                                                                                                                                                                | —                                                             | New work in foundation task #2.                                                                                                           |
| **CollectorDetailPage is broken.** "Unexpected token '<', '<!doctype' is not valid JSON" — the API call returns HTML when it expects JSON.                                                                                                                                                 | `src/features/collector/collector-detail-page.tsx` (presumed) | Out of scope for foundation, but worth a sub-issue so it isn't forgotten. The detail page rewrite in Project 04 will replace this anyway. |
| **No CNCF callout component or rendering anywhere.**                                                                                                                                                                                                                                       | —                                                             | New work.                                                                                                                                 |
| **No Playwright visual regression suite.** Playwright is in `devDependencies` but `playwright.config.*` doesn't exist.                                                                                                                                                                     | —                                                             | First-time setup as part of foundation testing.                                                                                           |

---

## Per-foundation-task delta

For each task in [`00-foundation.md`](./00-foundation.md), what exists today vs. what it needs to
become.

### 1. Theme tokens

**Today:** Single `dark-blue` theme. `--*-hsl` CSS properties injected by `ThemeProvider`. `@theme`
block in `index.css` exposes a subset (`--color-primary`, etc.) for Tailwind v4 utility generation.

**Target:** Same plumbing, but with `light` + `dark` + `auto` themes. `themes.ts` exports a
`Record<ThemeId, Theme>` keyed by `"light" | "dark"` (or whatever ID convention we land on). The
`@theme` block in `index.css` adds the OTel purple secondary (`#4f62ad`) and locks defaults that
match the actual default theme on first paint.

**Concrete delta:**

- `themes.ts`: extend `ThemeId` union, add `light` + `dark` theme entries. Keep `dark-blue` as an
  alias if we don't want to break existing references.
- `index.css`: rewrite `@layer theme` defaults to match the **dark** theme exactly (since dark is
  closer to the placeholder users see today). Add `[data-theme="light"]` overrides.
- `theme-context.tsx`: read initial theme from `localStorage["td-color-theme"]` (matching
  opentelemetry.io's key), fall back to `prefers-color-scheme`. Honor `auto` mode by listening to
  `matchMedia` changes.
- New: a no-flash inline script in `index.html` that reads the stored theme and applies the
  attribute before React hydrates (mirrors opentelemetry.io's `data-theme-init` pattern).

### 2. Theme toggle UI

**Today:** None.

**Target:** A button in the new navbar that cycles `light → dark → auto`. Persists choice. ARIA
label and `aria-pressed` state.

**Concrete delta:** New `<ThemeToggle />` component in `components/ui/`. Consumes `useTheme()` from
`theme-context.tsx`. Lucide icons (`Sun`, `Moon`, `Monitor`).

### 3. NavBar

**Today:** `Header` at `components/layout/header.tsx`. Sticky, h-16, OTel logo + 2 nav links (Java
Agent, Collector).

**Target:** opentelemetry.io-style: logo lockup + Docs · Ecosystem · Status · Community · Training ·
Blog · **Explorer** · search · language · theme toggle. Always-dark even in light mode (matches
opentelemetry.io).

**Concrete delta:** New `<NavBar />` at `components/layout/nav-bar.tsx`. App.tsx swaps based on
`isEnabled("V1_REDESIGN") ? <NavBar /> : <Header />`. Old `Header` keeps existing tests passing
during transition.

### 4. SubNav

**Today:** None — there's no breadcrumb pattern in the codebase.

**Target:** Component with breadcrumb trail + optional right-side action slot. Used on every inner
page (ecosystem landing, list, detail).

**Concrete delta:** New `<SubNav>` at `components/layout/sub-nav.tsx`. Probably just consumes React
Router's location and an array of crumbs from a route config.

### 5. Footer

**Today:** `Footer` at `components/layout/footer.tsx`. 3-column: branding + tagline + nav links.

**Target:** Two-cluster Docsy-style: 7 social/info icons left, copyright center, 7 GitHub/community
icons right. Uses Lucide for consistency (avoid adding Font Awesome — see open question).

**Concrete delta:** New `<FooterV1 />` (name TBD). Same flag swap pattern as NavBar. Footer test
(`footer.test.tsx`) gets a sibling test for the new version.

### 6. CncfCallout

**Today:** None.

**Target:** Component rendering: "OpenTelemetry is a CNCF incubating project. Formed through a
merger of the OpenTracing and OpenCensus projects." + CNCF logo. Sits above the footer on every
route when `V1_REDESIGN` is on.

**Concrete delta:** New `<CncfCallout />` at `components/layout/cncf-callout.tsx`. CNCF logo SVG in
`components/icons/`. Optional layout slot in `App.tsx` (within the `V1_REDESIGN` branch).

### 7. StatusPill

**Today:** Two related primitives:

- `StabilityBadge` — only handles `"development"`, returns `null` otherwise.
- `GlowBadge` — variants `primary | success | info | warning | muted`, no `error/danger`.

**Target:**
`<StatusPill stability="development | alpha | beta | stable | deprecated | unmaintained" />` with
the locked color mapping from the OTel collector stability spec (secondary / warning / info /
success / danger / danger). See Q5 in "Open questions" above for the full table.

**Concrete delta:**

- New `<StatusPill>` at `components/ui/status-pill.tsx`. Internally uses `GlowBadge` with the right
  variant.
- Add
  <!-- markdownlint-disable-next-line MD013 -->
  `error: { base: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400", glow: "shadow-sm shadow-red-500/20" }`
  to `GlowBadge`'s `variantStyles`.
- Decide whether `StabilityBadge` becomes a thin wrapper over `StatusPill` for backward
  compatibility, or gets deprecated.

### 8. TypeStripe primitive

**Today:** None — current cards have no left-edge color stripe.

**Target:** A 4px left-edge stripe component that callers can compose into rows and cards. Five
colors mapped to receiver / processor / exporter / connector / extension.

**Concrete delta:** New `<TypeStripe type="receiver | …" />` at `components/ui/type-stripe.tsx`.
Pure CSS — no logic — but typed so consumers don't pass arbitrary strings. Color tokens added to
`themes.ts` and `index.css` `@theme` block.

### 9. Card primitive

**Today:** Two card-shaped components:

- `NavigationCard` — for landing-page navigation tiles
- `DetailCard` — for detail pages

**Target:** Audit both. If one is general enough, extend it with an optional `typeStripe` slot.
Otherwise introduce a small `<Card>` primitive with `typeStripe` prop and migrate later.

**Concrete delta:** Read both files fully, decide. Likely a small generalization rather than a new
primitive.

### 10. DESIGN.md update

**Today:** DESIGN.md exists at `ecosystem-explorer/DESIGN.md` and represents the original dark-first
version. The longer alignment-focused version is captured in
[`./ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md).

**Target:** When the foundation lands, update `DESIGN.md` to describe the as-built tokens,
primitives, and the `data-theme` contract. We don't need the full alignment brief there — that's
what `ecosystem-explorer-v1-design-brief.md` is for.

**Concrete delta:** A documentation-only PR after the foundation primitives merge. Out of scope for
the first foundation PR.

### 11. Visual regression baseline

**Today:** Playwright is in `devDependencies` but no `playwright.config.*` and no `e2e/` or
`tests/visual/` directory.

**Target:** Playwright config + a small suite that snapshots NavBar, Footer, StatusPill (each
variant), Card, and TypeStripe in both themes.

**Concrete delta:**

- Add `playwright.config.ts`.
- Create a Storybook-lite route in dev mode (`/_dev/components`) that renders each primitive in both
  themes against fixtures. Or use Playwright's `componentTesting`. Decide which.
- Add `pnpm test:visual` (or `bun run test:visual`) script.

---

## Migration strategy: feature-flagged side-by-side

The existing flag system at `src/lib/feature-flags.ts` is exactly what we need.

### Add the flag

```ts
// src/lib/feature-flags.ts
const FEATURE_FLAGS = [
  "JAVA_CONFIG_BUILDER",
  "COLLECTOR_PAGE",
  "V1_REDESIGN", // ← new: gates NavBar + Footer + CncfCallout + theme toggle
] as const;
```

### Use the flag (App.tsx pattern)

```tsx
import { isEnabled } from "@/lib/feature-flags";

const v1Redesign = isEnabled("V1_REDESIGN");

return (
  <BrowserRouter>
    <div className="bg-background flex min-h-screen flex-col">
      {v1Redesign ? <NavBar /> : <Header />}
      <main className="flex-1 pt-16">
        <Routes>{/* unchanged */}</Routes>
      </main>
      {v1Redesign && <CncfCallout />}
      {v1Redesign ? <FooterV1 /> : <Footer />}
    </div>
  </BrowserRouter>
);
```

### Enable locally

```bash
# .env.local (gitignored)
VITE_FEATURE_FLAG_V1_REDESIGN=true
```

### Enable in Netlify previews

Already wired in `netlify.toml`: the build command pattern-matches the source branch (`$HEAD` for PR
previews, `$BRANCH` for branch deploys) and sets `VITE_FEATURE_FLAG_V1_REDESIGN=true` for any branch
starting with `feat/84-`. Production stays off until the cleanup PR flips it.

```toml
[build]
base = "ecosystem-explorer"
publish = "dist"
command = """
  if [[ "$HEAD" == feat/84-* || "$BRANCH" == feat/84-* ]]; then
    export VITE_FEATURE_FLAG_V1_REDESIGN=true
  fi
  npm run netlify-build:preview
"""
```

Practical effect: any PR opened from a `feat/84-*` branch — and any direct deploy of such a branch —
gets the redesign chrome on automatically. Other contributors' PRs see the placeholder unchanged.

### Cleanup, when ready

When all foundation tasks land + maintainers approve, a single PR removes the flag and deletes the
legacy `Header` / `Footer`. That's the "go-live" moment for Phase 1.

### Why not in-place replacement

- The current site is shipping. Replacing `Header` directly means `main` looks broken until
  everything lands.
- Side-by-side gives Netlify previews per PR with the flag on, so reviewers can see the diff
  visually.
- The cleanup PR is small and surgical, lowering review friction for the final swap.

---

## Testing infrastructure plan

| Layer             | Today                                                                                           | Target                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit              | Vitest, co-located `*.test.tsx`, `src/test/setup.ts`                                            | Same. New components ship with co-located tests.                                                                                                                         |
| Integration       | Separate config (`vitest.integration.config.ts`), helpers under `src/test/integration/helpers/` | Add integration tests for: theme persistence across reloads, flag-gated rendering, breadcrumb behavior.                                                                  |
| Visual regression | Playwright installed, **no config yet**                                                         | Add `playwright.config.ts`, set up a `/_dev/components` route or component-test mode, snapshot each primitive in light + dark. Baseline locked at the end of foundation. |
| A11y              | Nothing automated today                                                                         | Add `axe-core` integration in Playwright runs. Catches contrast and aria-attribute regressions.                                                                          |

---

## Open questions (must resolve — flagged for maintainer discussion)

These were carried over from `00-foundation.md`.

1. **`data-theme` vs. `data-bs-theme`.** The codebase uses `data-theme` already. Do we keep it (less
   churn, slight divergence from opentelemetry.io's Bootstrap-flavored chrome) or migrate to
   `data-bs-theme` (full alignment, requires updating `theme-context.tsx` and any CSS that reads
   it)?
   - **Why this matters now:** the theme task is the first PR. Choose before opening it.
   - **Decision (2026-05-06):** Keep `data-theme`. opentelemetry.io uses `data-bs-theme` because
     Hugo Docsy is Bootstrap-based; the explorer is on Tailwind v4 with no Bootstrap, so
     `data-bs-theme` would be misleading. Visual alignment with opentelemetry.io is driven by
     colors, layout, and component patterns — not the HTML attribute name. Smaller PR diff, more
     honest naming.

2. **Logo source.** Local `OtelLogo` SVG already exists at `src/components/icons/otel-logo.tsx`.
   Stick with it (recommended), or fetch the canonical SVG from `opentelemetry.io/img/logos/`?
   - **Why this matters now:** affects the NavBar PR.
   - **Decision (2026-05-06):** Stick with the current local `OtelLogo` component. Self-contained,
     no extra fetch dependency, already used elsewhere in the codebase. If the upstream SVG changes
     meaningfully later, we can revisit.

3. **Icon library: Lucide-only vs. add Font Awesome.** opentelemetry.io's footer uses Font Awesome
   heavily (Bluesky, Mastodon, Stack Overflow, etc.). The explorer uses Lucide. Mixing libraries
   adds bundle weight. Options:
   - **(a)** Stick with Lucide for the new footer; some icons (Bluesky, Mastodon) don't exist in
     Lucide and need custom SVGs.
   - **(b)** Add Font Awesome (~75kb minified) for footer parity.
   - **(c)** Inline SVGs for the missing brand marks; keep Lucide for everything else.
   - Recommended: **(c)** — minimal weight, full control.
   - **Decision (2026-05-06):** Option (c). Inline SVGs for the brand marks Lucide doesn't ship
     (Bluesky, Mastodon, Stack Overflow); use Lucide for everything else. Avoids adding ~75kb of
     Font Awesome for a handful of footer icons; keeps the bundle lean. Inline SVGs live alongside
     existing icon components under `src/components/icons/`.

4. **`StabilityBadge` deprecation path.** Does the new `<StatusPill>` replace `StabilityBadge`
   outright (one PR migrates all callers), or does `StabilityBadge` become a thin wrapper for
   backward compatibility?
   - **Why this matters now:** affects scope of the StatusPill PR.
   - **Recommended:** keep both, target different uses initially, migrate later in a separate
     cleanup PR. The current `StabilityBadge` is narrow (one state — `"development"` — rendered as a
     yellow "dev" pill, used inside the Java configuration builder). The new `<StatusPill>` is
     general-purpose with six states. They're different primitives with overlapping concerns.
     Building `<StatusPill>` in PR 4 without touching `StabilityBadge` keeps PR 4 small and focused,
     and decouples the configuration-builder visual from the foundation work. Migration becomes a
     follow-up cleanup PR after Phase 1 lands.
   - **Decision (2026-05-06):** Adopt the recommendation above. Add `<StatusPill>` in PR 4 as a new
     primitive; leave `<StabilityBadge>` callers unchanged for now. Migrate the configuration
     builder to `<StatusPill stability="development" />` in a follow-up PR after Phase 1 cleanup.

5. **Stability terminology in data.** The data uses `alpha | beta | development | unmaintained`.
   Visually we map to four colors (success/info/warning/danger). The `development` ↔ `alpha` overlap
   and `unmaintained` ↔ `deprecated` synonym need locking before pill colors ship.
   - **Maintainer call** — needs alignment with `ecosystem-registry` maintainers.
   - **Decision (2026-05-06):** Adopt the
     [OpenTelemetry Collector stability spec](https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md)
     verbatim. **Six** stability levels — Development, Alpha, Beta, Stable, Deprecated, Unmaintained
     — with this color mapping:

     | Level          | Semantic                                    | Pill variant       |
     | -------------- | ------------------------------------------- | ------------------ |
     | `development`  | Not all pieces in place; not for production | `secondary` (gray) |
     | `alpha`        | Limited non-critical workloads              | `warning` (orange) |
     | `beta`         | Configs deemed stable; broader usage        | `info` (blue)      |
     | `stable`       | General availability; production-ready      | `success` (green)  |
     | `deprecated`   | Planned removal; no further support         | `danger` (red)     |
     | `unmaintained` | No active code owner; will be removed soon  | `danger` (red)     |

     `deprecated` and `unmaintained` share the red color but show different labels — both signal
     "avoid" but for different reasons. This mirrors the collector's own stability ladder so anyone
     reading both sources sees the same vocabulary. `<StatusPill>` props update from
     `'stable' | 'beta' | 'alpha' | 'deprecated'` to the six values above.

---

## Action checklist before the first PR

- [x] Decide on `data-theme` vs. `data-bs-theme` (Q1) — locked: keep `data-theme`.
- [x] Decide on logo source (Q2) — locked: keep the local `OtelLogo` component.
- [x] Decide on icon library strategy (Q3) — locked: option (c), inline SVGs for missing brand
      marks; keep Lucide for everything else.
- [x] Decide on `StabilityBadge` deprecation path (Q4) — locked: keep both, target different uses;
      migrate in a follow-up cleanup PR after Phase 1.
- [x] Pin the stability-terminology mapping (Q5) — locked: six-level OTel collector spec
      (development / alpha / beta / stable / deprecated / unmaintained).
- [x] Add `V1_REDESIGN` to `FEATURE_FLAGS` (one-line PR — can ship first as a no-op). The
      `netlify.toml` build command already pattern-matches `feat/84-*` to enable the flag, so
      previews on those branches will pick it up immediately once the flag exists in
      `lib/feature-flags.ts`.
- [ ] Reconcile color drift: rewrite `index.css` defaults to match the actual default theme.

Once these are done, the first PR is **"Add light + dark + auto theme system + theme toggle in
navbar"** — small, visible, low-risk, gated by `V1_REDESIGN` so it can land without disrupting
`main`.

---

## Recommended PR sequence (preview)

This is _next_ — Project 00's "break Phase 1 into PRs" track. Listed here as a preview so the audit
feels complete:

1. **PR 0: Add V1_REDESIGN flag** (1-line in `lib/feature-flags.ts` — unblocks everything;
   `netlify.toml` already pattern-matches `feat/84-*` so previews pick it up automatically).
2. **PR 1: Theme system** — extend themes, no-flash init, theme toggle in a stub navbar.
3. **PR 2: NavBar v1** — full opentelemetry.io-style navbar; theme toggle moves into it.
4. **PR 3: SubNav** — breadcrumb component used by inner pages.
5. **PR 4: StatusPill + GlowBadge `error` variant** — locks status mapping.
6. **PR 5: TypeStripe + Card primitive update** — unblocks list and detail page projects.
7. **PR 6: FooterV1 + CncfCallout** — closes the chrome.
8. **PR 7: Playwright visual regression baseline** — locks the look.
9. **PR 8: Cleanup** — remove `V1_REDESIGN` flag, delete legacy `Header`/`Footer`, update
   `DESIGN.md`.

Each PR is small enough for one contributor and one reviewer; each can ship independently behind the
flag.
