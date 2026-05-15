---
title: "Pivot — V1_REDESIGN flag-sprawl → src/v1/ router-boundary"
issue: 84
type: brief
phase: 1
status: in-progress
last_updated: "2026-05-13"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Pivot — V1_REDESIGN flag-sprawl → `src/v1/` router-boundary

Direction-setting note for the Phase 1 mechanism change decided after the discussion at the
2026-05-12 OpenTelemetry Communications SIG call. Read this before touching any redesign-era code or
extending the foundation plan in [`00-foundation.md`](./00-foundation.md).

## Context

The original Phase 1 plan staged the redesign as nine PRs, each gated by an
`isEnabled("V1_REDESIGN")` call sprinkled at the points where v1 content diverges from the legacy
chrome — `App.tsx` swapping `<Header />` for `<NavBar />`, `main.tsx` setting `data-v1-redesign` on
`<html>` for CSS scoping, and an envisioned cascade of similar reads inside future pages.

On the 2026-05-12 SIG call
([Zoom recording](https://zoom.us/rec/play/6w6ij69psp17Vo3GaZeaarr7mDGOfrUNE2m7HuIDb1XCwKvmnBWzWkcli9lU3Q3xMyqeFa3aNxyFWJs.WcZZoY03UygQ-toH)),
Jay DeLuca raised — and Vitor agreed — that the per-component flag pattern will not scale across a
multi-month redesign. The two concrete pains:

- **Conflicts under parallel development.** Each new flagged region in a shared file is a
  merge-conflict surface when multiple PRs touch the same page. The longer the redesign runs, the
  worse this gets.
- **Hard to review.** A reviewer reading a flagged-component PR has to mentally reconstruct the
  "flag on" view against the surrounding "flag off" code. Jay: "having it as separate as possible
  for the review process is probably our easiest path forward."

Vitor's response on the call captured it: "I was trying to have the feature flagged to avoid many
conflicts, but... I think this is going to be too hard to avoid them, or to have both versions
living under the same space at the same time."

## Decision

**Pivot from "V1_REDESIGN gates individual components within shared files" to "a single V1_REDESIGN
boundary read in `src/App.tsx` swaps between two top-level sub-apps, each owning its own directory
tree."**

Concretely:

- **New directory `ecosystem-explorer/src/v1/`** owns the v1 page tree (homepage, ecosystem landing,
  list page, detail page) and v1 chrome (`NavBar`, `Footer`, `CncfCallout`, `SubNav`). v1's
  top-level component `<V1App />` defines its own `<Routes>`.
- **`src/App.tsx` reduces to a single boundary read:**
  `isEnabled("V1_REDESIGN") ? <V1App /> : <LegacyApp />`. That is the only place `V1_REDESIGN` is
  referenced for application routing decisions. No `data-v1-redesign` attribute on `<html>` (the
  class-based scoping below replaces it).
- **One narrow carve-out in `main.tsx` for early-paint styling.** `main.tsx` reads the flag once to
  add the `.v1-app` class to `<html>` before React mounts. This keeps body bg painted against v1
  surface tokens from the first paint (zero navy-to-v1 flash during the React mount window). The
  check uses the same `isEnabled("V1_REDESIGN")` API as the App.tsx boundary read, so it's a runtime
  check that fires once at module load, not a build-time constant. CSS variables declared on
  `.v1-app` cascade through `<body>` via `body { background-color: hsl(var(--background-hsl)) }` in
  `src/styles/base.css`. PR 2b implements this; PR 8 cleanup removes it along with the App.tsx
  boundary read.
- **No URL prefix.** v1 mounts at the canonical paths (`/`, `/java-agent/...`, etc.). Both sub-apps
  own the same path space; the boundary read decides which one is reachable.
- **Per-deploy bundle selection.** The existing `netlify.toml` pattern (`feat/84-*` branches set
  `VITE_FEATURE_FLAG_V1_REDESIGN=true`) is unchanged. The boundary read is a runtime check, not a
  build-time switch: `isEnabled("V1_REDESIGN")` reads `import.meta.env` via a computed key, which
  Vite's static-replacement pass cannot constant-fold. Both `<V1App />` and `<LegacyApp />` ship in
  both bundles (~5KB JS + ~11KB CSS unused per build); the runtime check picks which one mounts.
  Tree-shaking the unreachable branch is aspirational and would require either switching the
  boundary to literal-key `import.meta.env.VITE_FEATURE_FLAG_V1_REDESIGN` or using `React.lazy()`
  for explicit code-splitting. Accepted trade-off for convention consistency with the rest of the
  codebase's flag reads. Reviewers compare a PR's preview to the production URL side-by-side in two
  tabs.

**Shared-primitives placement.** Cross-cutting primitives stay in `src/components/ui/` — that
includes `StatusPill`, `GlowBadge`, `ThemeToggle`, and future `TypeStripe` / `Card` work. Chrome and
page-level features that exist only for v1 live under `src/v1/`. No retroactive moves of code
already merged on `main` (PR 1 theme system, PR 4 StatusPill).

**Cutover model.** The cleanup PR (PR 8) does five things in one diff:

1. Removes the `isEnabled("V1_REDESIGN")` read in `src/App.tsx`.
2. Removes the `main.tsx` carve-out that adds `.v1-app` to `<html>` pre-mount (after cutover, v1 is
   unconditional, so the class can move to a static `<html class="v1-app">` in `index.html` — or the
   v1 surface tokens can move back to `:root` since they're the only palette).
3. Deletes the `<LegacyApp />` branch.
4. Deletes legacy chrome (`src/components/layout/header.tsx`, the legacy `Footer`) and legacy
   feature directories that v1 has replaced.
5. Removes the `V1_REDESIGN` entry from `src/lib/feature-flags.ts` and the `feat/84-*` pattern from
   `netlify.toml`.

After cutover, v1 is the only app. `src/v1/` stays in place; a future flattening (hoisting
`src/v1/*` up into `src/`) is out of scope.

## Consequences

- **The `V1_REDESIGN` flag is not removed** by this pivot — it is _narrowed_ from "many sprinkled
  reads" to "one boundary read." PR 8 still owns the final removal.
- **PR 2 (#453) is re-scoped.** The branch keeps the navbar component, theme-toggle rewrite, icons,
  and CSS as **dormant** code (no consumer in this PR). The `<NavBar />` mount in `App.tsx` and the
  `data-v1-redesign` attribute in `main.tsx` are reverted. Docs in this PR capture the pivot.
- **New PR 2b** introduces `src/v1/`, writes a minimal `<V1App />`, moves the dormant navbar from
  `src/components/layout/` into `src/v1/components/layout/`, and adds the single boundary read in
  `App.tsx`.
- **PR 3 (SubNav), PR 6 (Footer + CncfCallout)** land into `src/v1/components/`. Their scope is
  unchanged; only their location moves.
- **PRs 4 (StatusPill — already shipped), 5 (TypeStripe + Card), 7 (Playwright)** continue to use
  `src/components/ui/`. Cross-cutting primitives stay shared.
- **CSS scoping that depended on the `data-v1-redesign` attribute** moves into v1-only stylesheets
  imported by `src/v1/` under the `.v1-app` class. `main.tsx`'s one-line carve-out (above) sets the
  class on `<html>` pre-mount so the cascade reaches `<body>`. `<V1App />`'s wrapper
  `<div className="v1-app">` also carries the class for nested scoping. **Locked in PR 2b's grilling
  session (2026-05-13).**

## Supersedes

This decision supersedes three rows in the NEXT-STEPS.md decision log:

- **2026-05-05 — "Stage Phase 1 into 9 PRs gated by V1_REDESIGN flag."** Still staged as a sequence
  of small PRs (now ten including PR 2b), and still gated by `V1_REDESIGN` — but "gated" now means a
  single boundary read, not per-component sprawl.
- **2026-05-05 — "Migration strategy: feature-flagged side-by-side, swap in cleanup PR."** Now:
  directory-separated; per-deploy bundle via the runtime boundary read (tree-shaking the unreachable
  branch isn't currently in play because `isEnabled()` uses computed-key env access that Vite can't
  constant-fold; both branches ship in both bundles); swap is still in the cleanup PR but is a
  delete-the-other-half diff rather than a flag flip.
- **2026-05-07 — "PR 1 dark-surface reconciliation lands globally on `main`; V1_REDESIGN gates UI
  components/layout, not the base palette."** Still accurate; the gate just moved from per-component
  reads to a single boundary read.

It does **not** supersede:

- **PR 0 (flag added on `main`).** The `V1_REDESIGN` entry in `feature-flags.ts` stays — that's the
  boundary flag.
- **PR 1 (theme system).** Lives in `src/styles/` + `src/components/ui/` (shared). No moves.
- **PR 4 (StatusPill).** Lives in `src/components/ui/status-pill.tsx` (shared). No moves.
- **2026-05-06 — Netlify preview pattern in `netlify.toml`.** The `feat/84-*` branch-name match
  remains the per-deploy bundle selector.

## References

- [`NEXT-STEPS.md`](./NEXT-STEPS.md) — rolling roadmap; updated decision log row and Phase 1 PR
  table reflect this pivot.
- [`00-foundation.md`](./00-foundation.md) — task list updated to note v1 chrome lives under
  `src/v1/`.
- [`00-foundation-audit.md`](./00-foundation-audit.md) — concrete deltas and the migration-strategy
  section updated to describe the boundary-read pattern.
- [`_index.md`](./_index.md) — folder landing page updated to reflect the new mechanism.
- Issue [#370](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/370) —
  Phase 1 tracker; PR list refreshed to include PR 2b and the re-scoped PR 2.
