# Readiness mode

The QA pass. Each check below says how to run it and when it fails. Record every failure as
evidence in the page checklist ([`checklist.md`](checklist.md)), then classify it against the
blocker criteria in [`SKILL.md`](SKILL.md).

## Which checks run

| Check                 | Tier 1    | Tier 2    | Run by                |
| --------------------- | --------- | --------- | --------------------- |
| Legacy parity         | yes       |           | area review           |
| Layout integration    |           | yes       | area review           |
| Visual                | yes       | yes       | area review           |
| Design                | yes       |           | area review           |
| React Doctor          | yes       |           | area review           |
| Duplicated components | yes       |           | area review           |
| Accessibility         | yes       | yes       | cross-cutting review  |
| i18n                  | yes       | yes       | cross-cutting review  |
| Performance           | key pages | key pages | cross-cutting review  |
| Tests                 | yes       | yes       | cross-cutting review  |

An area review runs its rows for every route in its area. A cross-cutting review runs its one row
over every route. A review of a single page that has no review sub-issue runs every row.

## Tools

Run these from `ecosystem-explorer/` after `bun install --frozen-lockfile`.

- **Screenshots and axe against staging.** No local build needed. The first run also needs
  `bunx playwright install chromium`.

  ```bash
  ACCEPTANCE_BASE_URL=https://v1--otel-ecosystem-explorer.netlify.app bun run screenshots:capture
  ```

  It writes `screenshots/<viewport>-<theme>-<page>.png` (desktop 1800, tablet 768, mobile 390;
  dark and light) and `a11y/<page>-<theme>.json`. `scripts/take-screenshots.mjs` lists the routes it
  captures; every other route gets the same widths and themes by hand in a browser.

- **Local V1**, when staging is behind `main`:
  `VITE_FEATURE_FLAG_V1_REDESIGN=true bun run serve --port 5199 --strictPort` for browsing, or
  `VITE_FEATURE_FLAG_V1_REDESIGN=true bun run build` followed by `bun run screenshots:capture` for
  the captures. The tracked `.env.development` sets the flag to `false`, so pass it on every run.

## Legacy parity (tier 1)

Open the same path on production (legacy) and on staging (V1). Write down every capability of the
legacy page: filters and their options, search, sort, data fields, links out, and URL query
parameters. Then find each one on V1, and paste a legacy URL with its query string into staging to
check that deep links still land on the equivalent state.

Fails when a capability is missing, or a legacy URL lands on the wrong state or a 404. Before filing,
search the decision log in `projects/84-ui-ux-design/NEXT-STEPS.md`: a removal recorded there was
intentional and is not a regression.

## Layout integration (tier 2)

The legacy page renders inside the V1 navbar and footer. Check that exactly one header and one footer
render, that the theme toggle recolors the page body as well as the navbar and footer, that the language menu
translates the page, and that the page works the way it does on production, without console errors.

Fails on clashing legacy styles (a broken visual), on a feature that works on production and fails on
staging (a functional regression), or on console errors.

## Visual (both tiers)

Review every page at desktop, tablet, and mobile width, in dark and light. Beyond the default state,
open what the captures miss: the theme and language menus, the global search dropdown, hover and
focus states, and the empty, error, and loading states (filter down to zero results, request a
component that does not exist).

Fails on broken layout, clipped or overlapping content, horizontal scroll, text that becomes
unreadable, or an element that disappears in one theme.

## Design (tier 1)

Compare the page with `ecosystem-explorer/DESIGN_V1.md`, the as-built V1 design system. For the
shared layout, compare
with opentelemetry.io itself: its styles live in `assets/scss/` of the
[opentelemetry.io repository](https://github.com/open-telemetry/opentelemetry.io) and in its Docsy
theme.

`ecosystem-explorer/DESIGN.md` describes the legacy system, so a difference from it is not a
finding. When the page and `DESIGN_V1.md` disagree, file a finding against the page if the page is
wrong. If the doc is out of date or silent, file a non-blocking finding to update `DESIGN_V1.md`.
The cleanup PR renames `DESIGN_V1.md` to `DESIGN.md`. The HTML mockup in `projects/84-ui-ux-design/` is a
sketch, so a difference from the mockup alone is not a finding.

Fails on inconsistent tokens, typography, spacing, or component use that a user would notice.
Non-blocking unless it also breaks the visual.

## React Doctor (tier 1)

```bash
bunx react-doctor@latest . --verbose -y
```

Keep the findings in the area's files (`src/v1/features/<area>/` and the `src/v1/components/` it
uses). CI runs the same tool on every PR (`.github/workflows/react-doctor.yml`) in advisory mode.

Fails on an error-severity finding in the area's files. Non-blocking.

## Duplicated components (tier 1)

While reading the area's components, note any that re-implement a component another ecosystem
already has, for example a Collector-only component whose Java Agent twin differs only in data. File
each as a non-blocking finding that names both components and what a shared version would take.

## Accessibility (both tiers)

- **axe**: every entry under `violations` in `a11y/<page>-<theme>.json` fails. axe scans only the
  default state of the captured routes, so run the axe DevTools browser extension, in both themes,
  on uncaptured routes and on open menus, drawers, and the search dropdown.
- **Keyboard**: tab through the whole page. Every control is reachable, focus is visible and moves in
  reading order, Escape closes menus, drawers, and search, and focus returns to the control that
  opened them.
- **Screen reader** (VoiceOver or NVDA): on the page's main interaction (search, facet filters,
  tabs), every control announces its name, role, and state.
- **Non-text contrast**: focus rings, input borders, and icons that carry meaning reach 3:1 in both
  themes. axe covers text contrast.

Every failure here is a WCAG 2.1 AA blocker.

## i18n (both tiers)

On staging, switch the language menu to Español. Any English left in the UI is a finding: visible
text, `aria-label`s (read them in the browser's accessibility tree), `title` tooltips, placeholders,
empty, error, and loading states, and number or date formats. Registry data (component names,
descriptions, attribute keys), product names, and code identifiers stay in English and are not
findings.

Key parity between `en` and `es` is a unit test that CI runs on every PR:
`bun run test src/i18n/locale-parity.test.ts`.

Every failure here is a missing-i18n blocker.

## Performance (key pages, both tiers)

Record numbers; findings here are non-blocking.

- **Lighthouse** (Chrome DevTools, mobile preset) on staging for `/`, `/collector/components`, one
  Collector component page, and `/java-agent/instrumentation`: performance score, LCP, TBT, CLS.
- **Bundle**: `bun run build` prints chunk sizes. Note every chunk above 500 kB.
- **IndexedDB**: after browsing both ecosystems, run `await navigator.storage.estimate()` in the
  console and note `usage`.
- **Release diffs**: time `/java-agent/releases` between the oldest and newest versions, and a
  Collector component diff across its widest version range.
- **Field data**: the production Grafana dashboard linked from the performance review sub-issue.
  Production runs the legacy app until go-live, so its numbers are the baseline to compare against.

File a finding for anything a user would notice as slow, such as a spinner that lasts more than about
two seconds or janky scrolling, with the numbers as evidence.

## Tests (both tiers)

```bash
bun run test && bun run test:integration
```

For each page in scope, check two things: a co-located `*.test.tsx` covers the page and its main
components, and `scripts/take-screenshots.mjs` captures the page (visual regression plus axe).
If `java-instrumentation-list-page.test.tsx` fails only in the full suite, rerun it alone: it has
had a flake that shows up only in full-suite runs.

Report failing tests with their output. A page without tests or without screenshot coverage is a
non-blocking finding.
