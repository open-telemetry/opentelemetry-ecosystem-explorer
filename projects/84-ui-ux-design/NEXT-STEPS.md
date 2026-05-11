---
title: "Roadmap — explorer redesign"
issue: 84
type: roadmap
phase: meta
status: planning
last_updated: "2026-05-07"
---

## Next steps

> Rolling roadmap for the explorer redesign tracked under
> [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84). Reflects the
> state of the work after our planning sessions on `feat/84-layout-mockups`.

This is a _living_ document. Update it as decisions land and PRs ship. Cross-references:

- [`00-foundation.md`](./00-foundation.md) — Phase 1 project plan
- [`00-foundation-audit.md`](./00-foundation-audit.md) — Current-state audit + per-task delta + open
  questions
- [`01-home-page.md`](./01-home-page.md) · [`02-ecosystem-landing.md`](./02-ecosystem-landing.md) ·
  [`03-list-page.md`](./03-list-page.md) · [`04-detail-page.md`](./04-detail-page.md) — Per-page
  project plans
- [`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md) — Design
  rationale and direction
- [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html) — Visual reference (4
  pages, light + dark)

---

## Where we are

- The branch `feat/84-layout-mockups` holds the design brief, the HTML mockup, the four page-project
  files, and the foundation audit.
- The audit confirmed the codebase is in better shape than the placeholder screenshots suggested:
  feature flag system exists, theme provider exists, layout components exist, several UI primitives
  we'd planned to build already exist.
- DESIGN.md was reverted to its original form by the maintainer; the alignment-focused version lives
  in `ecosystem-explorer-v1-design-brief.md` for now.
- **PR 0 is effectively done.** `V1_REDESIGN` is already in `src/lib/feature-flags.ts` (added
  alongside `JAVA_RELEASE_COMPARISON` in a prior main commit). `netlify.toml` already
  pattern-matches `feat/84-*` branches to enable the flag for previews. The flag is a no-op until PR
  2 wires it into `App.tsx`.
- **Brand realignment (`primary = blue`, `secondary = orange`) is already on `main`.** The canonical
  hues (`228 37% 49%` blue, `41 100% 48%` orange) are already in `src/index.css` from a prior merge.
  PR 1 does not need to flip these — only the five remaining surface tokens (card/muted/border) need
  reconciling.
- **PR 1 code is complete on `feat/84-pr1-theme-system`.** Implemented: `src/styles/` folder with
  modular CSS partials (`tokens.css`, `base.css`, `syntax.css`), light theme block added, remaining
  dark surfaces reconciled to navy, `theme-context.tsx` rewritten (`mode`/`resolved`/`setMode` API,
  `localStorage` persistence, `matchMedia` auto mode), no-flash init script in `index.html`,
  `<ThemeToggle />` component authored (not yet rendered — PR 2 slots it into NavBar). All 781 tests
  pass; `tsc -b` clean. Pending: Vitor's commits + opening the PR.

---

## Immediate next steps

In order:

- [ ] Commit and open PR from `feat/84-pr1-theme-system` — code is complete, tests green, typecheck
      clean. See commit messages in the session log. No visible UI changes; verification via
      DevTools.
- [ ] Merge `feat/84-layout-mockups` (planning artifacts) as its own PR so the docs are on `main`.
      Can happen in parallel with PR 1 review.
- [ ] Start PR 2 (`feat/84-pr2-navbar`) off `feat/84-layout-mockups` (or `main` once it merges):
      `NavBar` component, always-dark, renders `<ThemeToggle />` from PR 1, wires `V1_REDESIGN` into
      `App.tsx` for the first time.

---

## Phase 1 — Foundation (in progress)

The audit recommends 9 PRs for Phase 1. Each is small, gated by `V1_REDESIGN` so it lands without
disrupting `main`, and reviewable by one person.

| #   | PR                                                    | Scope                                                                                                                                                                                                                                                                                                                                                                                            | Blocks                        | Status                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | --------------------------- |
| 0   | Add `V1_REDESIGN` flag                                | One line in `src/lib/feature-flags.ts`. Ships as a no-op.                                                                                                                                                                                                                                                                                                                                        | All other foundation PRs      | ✅ Done (on `main`)         |
| 1   | Theme system                                          | `src/styles/` folder (modular CSS partials). Light + dark + auto switching. No-flash init script in `index.html`. Reconcile dark surface tokens. Persist to `localStorage["td-color-theme"]`. `<ThemeToggle />` authored (not rendered). **Note:** dark-surface reconciliation is global (no `V1_REDESIGN` gate); light theme, persistence, and toggle are additive with no consumer until PR 2. | PR 2 (toggle lives in NavBar) | 🚧 Implemented — pending PR |
| 2   | NavBar v1                                             | Replace `Header` behind the flag. opentelemetry.io-style: logo + Docs · Ecosystem · Status · Community · Training · Blog · Explorer · search · language · theme toggle.                                                                                                                                                                                                                          | PR 3 (SubNav sits beneath it) | —                           |
| 3   | SubNav                                                | Breadcrumb component + optional right-side actions slot. Used by inner pages.                                                                                                                                                                                                                                                                                                                    | Phases 2-5                    | —                           |
| 4   | StatusPill + GlowBadge `secondary` + `error` variants | Add `<StatusPill>` covering all six OTel stability levels (development / alpha / beta / stable / deprecated / unmaintained). Leave legacy `StabilityBadge` untouched; migrate in a follow-up cleanup PR.                                                                                                                                                                                         | Phases 3, 4                   | —                           |
| 5   | TypeStripe + Card primitive update                    | 4px left-edge stripe primitive (5 colors) + extend `DetailCard` with the stripe slot (not `NavigationCard` — too specialized).                                                                                                                                                                                                                                                                   | Phases 3, 4                   | —                           |
| 6   | FooterV1 + CncfCallout                                | Two-cluster Docsy-style footer + CNCF callout above it. Inline SVGs for Bluesky / Mastodon / Stack Overflow icons (assuming we go with the recommended icon strategy).                                                                                                                                                                                                                           | —                             | —                           |
| 7   | Playwright visual regression baseline                 | Configure Playwright. Snapshot each primitive in light + dark. Add `axe-core` for a11y.                                                                                                                                                                                                                                                                                                          | Phase 1 cleanup               | —                           |
| 8   | Cleanup                                               | Remove `V1_REDESIGN` flag. Delete legacy `Header` / `Footer`. Update `DESIGN.md` to reflect as-built.                                                                                                                                                                                                                                                                                            | Phase 2                       | —                           |

PR 8 is the **go-live** moment — once it merges, Phase 1 is done and the new chrome ships to
production.

### What's NOT in Phase 1

To keep scope honest:

- Replacing the broken `CollectorDetailPage` (Project 04 owns this).
- Replacing the home page hero / search / stats (Project 01 owns this).
- Touching the data layer (`lib/api/*`).
- Touching the Java agent configuration builder (it's a substantial existing feature; out of scope
  unless something we change breaks it).
- Adding Storybook (use a `/_dev/components` route or Playwright component testing instead).

---

## Phase 2 — Home page (Project 01)

Starts after Phase 1 cleanup ships. See [`01-home-page.md`](./01-home-page.md). Big rocks:

- Cover-block hero with global ⌘K search.
- OTel-purple stats band (synced with opentelemetry.io's canonical numbers).
- Ecosystems grid (Collector, Java Agent, plus dashed "coming soon" cards).
- Browse-by-signal row (Traces · Metrics · Logs · Baggage — note **Baggage**, not Profiles).
- Recent activity rail.

**Prerequisite work that may turn up here:** a cross-ecosystem search index (currently nothing
exists — see open questions in `01-home-page.md`).

---

## Phase 3 — Ecosystem landing (Project 02)

Per-ecosystem overview pages. See [`02-ecosystem-landing.md`](./02-ecosystem-landing.md). Big rocks:

- Per-ecosystem hero with release card (latest version + delta).
- **Pipeline anatomy diagram** — reusable component that doubles as a one-click filter into the
  list.
- Quick-entry strip (most-used / core vs. contrib / diff across versions).

**Coupling with Phase 4:** the pipeline-anatomy diagram needs the URL contract from the list page.
The two phases can run in parallel once that contract is locked (it's a shared `listFilters`
parser/serializer — see `03-list-page.md` Task 1).

---

## Phase 4 — List page (Project 03)

The biggest UX win. See [`03-list-page.md`](./03-list-page.md). Big rocks:

- Faceted left rail (Type, Signal, Stability, Distribution, Version).
- Density toggle (Cards / Compact / Table).
- Active-filter chips with `Clear all`.
- URL-persisted state (`?type=receiver&signal=traces&...`).

**Hard dependency on Phase 1 deliverables:** StatusPill (PR 4), TypeStripe (PR 5).

---

## Phase 5 — Detail page (Project 04)

The atom of the explorer. See [`04-detail-page.md`](./04-detail-page.md). Split into two PRs to keep
review manageable:

- **PR 04a** — Three-pane shell, sibling navigator, tabbed embedded docs (Configuration / README /
  Attributes / Examples), pipeline placement diagram.
- **PR 04b** — Version timeline + diff view + compatibility card.

**Hard dependency on data:** per-version config schemas, emitted attributes, and version history
must be exposed by `ecosystem-registry` / `ecosystem-automation` for PR 04b. May require a separate
data-pipeline PR before 04b can ship.

---

## Decisions blocking progress

Foundation-scoped decisions (#1, #2, #3, #5, #6) were locked on 2026-05-06 — see the Decision log at
the bottom for the dated entries, and `00-foundation-audit.md` for the inline rationale next to each
question.

These are the ones that still need to land before the PRs they block:

| #   | Decision                                                              | Owner                | Blocks                              |
| --- | --------------------------------------------------------------------- | -------------------- | ----------------------------------- |
| 7   | Cross-ecosystem search architecture (client-side vs. dedicated index) | Vitor + maintainers  | Phase 2 (home)                      |
| 8   | Activity-feed source (build-time JSON vs. runtime API)                | Vitor + maintainers  | Phase 2 (home recent activity rail) |
| 9   | Per-version config schema availability in `ecosystem-registry`        | Registry maintainers | Phase 5 PR 04b (diff view)          |

(Numbering preserved for traceability against earlier conversations.) The longest-tail remaining
decision is **#9** — depends on `ecosystem-registry` maintainers and gates the Phase 5 diff view.
Surface early so it's not blocking when PR 04b is ready.

---

## Maintainer / community sync points

- **Issue #84 thread** — primary venue for design direction, scope, and prioritization. Use it to
  share the brief + mockup links and get directional sign-off before opening code PRs.
- **Sub-issues from #84** — one per Phase 1 PR (and one per Phase 2-5 project). Lets contributors
  grab work without coordinating heavily.
- **`ecosystem-registry` maintainers** — for the data-shape questions (stability terminology,
  per-version schemas, activity feed).
- **OTel community Slack**
  ([`#otel-ecosystem-explorer`](https://cloud-native.slack.com/archives/C09N6DDGSPQ)) — quick pings
  on visual decisions if the issue thread feels too heavy.

---

## Decision log

| Date       | Decision                                                                                                                                                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-30 | Direction: "The Catalog" with borrowed elements from Atlas + Dashboard                                                                                                                                                                        | See design brief. v1 spine: searchable, comparable, version-aware database.                                                                                                                                                                                                                                                 |
| 2026-04-30 | Align visual chrome with opentelemetry.io                                                                                                                                                                                                     | Same nav, footer, hero, stats, theme system, brand colors. Sub-product, not a separate microsite.                                                                                                                                                                                                                           |
| 2026-05-05 | Stage Phase 1 into 9 PRs gated by `V1_REDESIGN` flag                                                                                                                                                                                          | See "Phase 1 PR sequence" above. Avoids one big-bang PR.                                                                                                                                                                                                                                                                    |
| 2026-05-05 | Reuse existing feature-flag system at `src/lib/feature-flags.ts`                                                                                                                                                                              | Already in production use; no new infrastructure.                                                                                                                                                                                                                                                                           |
| 2026-05-05 | Migration strategy: feature-flagged side-by-side, swap in cleanup PR                                                                                                                                                                          | Per Vitor's choice in our sync.                                                                                                                                                                                                                                                                                             |
| 2026-05-05 | Set up `CLAUDE.local.md` (gitignored) with handling rules for `projects/` during the refactor                                                                                                                                                 | Personal session context for Claude; not shared with the project. Ensures continuity across sessions.                                                                                                                                                                                                                       |
| 2026-05-06 | Netlify previews enable `V1_REDESIGN` automatically for `feat/84-*` branches via build-command pattern matching in `netlify.toml`                                                                                                             | Reviewers see the flag-on view per PR with no manual env-var setup. Production stays off.                                                                                                                                                                                                                                   |
| 2026-05-06 | Keep `data-theme` (not `data-bs-theme`) on `<html>` for the theme attribute                                                                                                                                                                   | Foundation audit Q1. opentelemetry.io uses `data-bs-theme` because Hugo Docsy is Bootstrap-based; the explorer is on Tailwind v4 with no Bootstrap. Visual alignment is driven by colors / layout / patterns, not the attribute name. Smaller PR diff and more honest naming.                                               |
| 2026-05-06 | Stick with the local `OtelLogo` component for the navbar lockup                                                                                                                                                                               | Foundation audit Q2. Self-contained, no extra fetch dependency, already used elsewhere in the codebase.                                                                                                                                                                                                                     |
| 2026-05-06 | Footer icons: inline SVGs for missing brand marks (Bluesky, Mastodon, Stack Overflow); Lucide for everything else                                                                                                                             | Foundation audit Q3 — option (c). Avoids adding ~75kb of Font Awesome for a handful of icons; keeps the bundle lean.                                                                                                                                                                                                        |
| 2026-05-06 | `<StatusPill>` ships in PR 4 alongside `<StabilityBadge>`; migrate the configuration builder to `<StatusPill>` in a follow-up cleanup PR after Phase 1                                                                                        | Foundation audit Q4. `<StabilityBadge>` is narrow (one state, specific to the Java config builder). Building `<StatusPill>` without churning the configuration builder keeps PR 4 small and decouples the visual-decision risk.                                                                                             |
| 2026-05-06 | Status terminology follows the [OTel collector stability spec](https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md) — six levels: development / alpha / beta / stable / deprecated / unmaintained | Foundation audit Q5. Color mapping: development=secondary (gray), alpha=warning (orange), beta=info (blue), stable=success (green), deprecated=danger (red), unmaintained=danger (red). Mirrors the collector's vocabulary so anyone reading both sources sees the same terms.                                              |
| 2026-05-06 | PR 0 confirmed done — `V1_REDESIGN` is already in `src/lib/feature-flags.ts` on `main`                                                                                                                                                        | Added alongside `JAVA_RELEASE_COMPARISON` in a prior merge. `netlify.toml` was also already wired for `feat/84-*` previews. Flag is a no-op until PR 2 wires it into `App.tsx`. First real work is PR 1.                                                                                                                    |
| 2026-05-06 | PR 5 will extend `DetailCard`, not `NavigationCard`                                                                                                                                                                                           | Verified by reading both components. `DetailCard` is a general-purpose wrapper (`children` + `className` passthrough) — clean fit for a `typeStripe` prop. `NavigationCard` is specialized (hardcoded icon box, arrow, corner accent); restructuring it for the stripe slot is not worth the churn.                         |
| 2026-05-06 | Branch `feat/84-pr1-theme-system` created from `feat/84-layout-mockups`                                                                                                                                                                       | PR 1 stacks on the planning branch so planning artifacts and first code PR can ship together (separate reviews).                                                                                                                                                                                                            |
| 2026-05-06 | No SCSS — use pure CSS partials in `src/styles/` (Tailwind v4 is the preprocessor)                                                                                                                                                            | Tailwind v4 [explicitly recommends against SCSS/Less/Stylus](https://tailwindcss.com/docs/compatibility#sass-less-and-stylus); it ships nesting, `@import` bundling, and vendor prefixing via Lightning CSS. All architecture goals (declared variables, folder structure, separation of concerns) achieved with plain CSS. |
| 2026-05-06 | Brand realignment (`primary = blue`, `secondary = orange`) confirmed already on `main`; PR 1 does not flip these values                                                                                                                       | Re-reading `src/index.css` during the session revealed the canonical hues are already in place. PR 1 only reconciles the five remaining dark surface tokens (card/muted/border) and adds the light theme block.                                                                                                             |
| 2026-05-06 | PR 1 `theme-context.tsx` API: `{ mode, resolved, setMode }` — `mode` is the user preference (`light`/`dark`/`auto`), `resolved` is what's applied to the document                                                                             | Cleaner than the old `{ themeId, setThemeId }` API. CSS owns values via `[data-theme]`; JS only sets the attribute. `useTheme` has zero non-test production consumers so the API reshaping is free.                                                                                                                         |
| 2026-05-07 | PR 1 dark-surface reconciliation lands globally on `main`; `V1_REDESIGN` gates UI components/layout, not the base palette                                                                                                                     | Brand hues already on `main`; only the secondary surface tokens shift, and only for dark-theme users. Keeps PR 1 small and avoids a CSS indirection that PR 8 cleanup would have to unwind.                                                                                                                                 |
| 2026-05-07 | Drop `dark-blue` alias from `themes.ts` — the prior theme code never wrote to `localStorage`, so the alias was dead code with no real users behind it                                                                                         | The `td-color-theme` storage key is brand-new in PR 1; no migration needed.                                                                                                                                                                                                                                                 |
| 2026-05-11 | Hero restored to orange-dominant after primary/secondary swap                                                                                                                                                                                 | Compass glow + ambient radial use `--otel-orange-hsl`; text gradient runs blue→orange. Addresses Jay's PR review feedback that "all the oranges turned blue except for the compass center dot."                                                                                                                             |

Add a row whenever a decision lands. Keeps the doc honest.
