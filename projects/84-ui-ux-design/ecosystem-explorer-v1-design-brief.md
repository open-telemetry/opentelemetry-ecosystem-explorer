---
title: "v1 design proposal — Ecosystem Explorer"
issue: 84
type: brief
phase: meta
status: complete
last_updated: "2026-05-06"
---

## v1 design proposal — Ecosystem Explorer

> Brainstorm for
> [#84 — \[Explorer\] UI/UX Design](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84).
> Builds on `DESIGN.md` and **aligns the explorer to the existing visual language of
> [opentelemetry.io](https://opentelemetry.io)**. Mockup HTML is included alongside this doc as
> `ecosystem-explorer-v1-mockups.html` — it's a static prototype with a tab switcher across all four
> page types and a working light/dark theme toggle.

---

## TL;DR

The placeholder design felt like a separate microsite rather than part of the OTel project. **The
fix is alignment, not redesign.** This proposal standardizes the explorer on the same visual grammar
as opentelemetry.io: same dark navbar, same light/dark theme toggle, same OTel purple `#4f62ad` and
orange `#f5a800`, same Bootstrap-flavored chrome (Docsy `td-*` patterns), same footer, same CNCF
callout, same canonical stats numbers ("12+ Languages · 200+ Collector Components · 1005+
Integrations · 102+ Vendors").

On top of that shared scaffold, the explorer adds the things opentelemetry.io can't: real faceted
filtering with URL state, a three-pane component detail page with version timeline + diff, density
toggles (Cards / Compact / Table), and pipeline-anatomy diagrams.

A user clicking from `opentelemetry.io/ecosystem/` to the Explorer should not feel they have left
the site.

---

## Why alignment first

The previous iteration of this brief proposed a strong direction ("The Catalog") with thoughtful IA.
What it didn't do was **lock the visual language to what opentelemetry.io already publishes**. Once
you put the two side by side, the gap is obvious:

| Element           | opentelemetry.io                                                                                         | v0 placeholder               | v1 (this proposal)                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme support     | Light + Dark + Auto (toggle in navbar, persisted to `td-color-theme` in `localStorage`)                  | Dark-only                    | **Light + Dark + Auto** (same key, same toggle)                                                                                                               |
| Brand purple      | `#4f62ad` (theme-color, mask-icon, primary stats band)                                                   | Not used                     | **`#4f62ad` adopted as `--color-secondary`**                                                                                                                  |
| Brand orange      | `#f5a800` (logo gradient, kapa accent)                                                                   | `38 95% 52%` HSL ≈ `#f5a800` | Already aligned ✓                                                                                                                                             |
| Topnav            | Always-dark `td-navbar`: Docs · Ecosystem · Status · Community · Training · Blog · search · lang · theme | Custom 2-link bar            | **Mirror full structure**, add Explorer entry                                                                                                                 |
| Stats numbers     | "12+ · 200+ · 1005+ · 102+"                                                                              | Made up our own              | **Match canonical numbers**                                                                                                                                   |
| Signals           | Traces · Metrics · Logs · **Baggage**                                                                    | Had Profiles                 | **Switch to Baggage**                                                                                                                                         |
| Footer            | Two clusters of Font Awesome social icons + centered copyright                                           | Custom                       | **Mirror Docsy footer**                                                                                                                                       |
| Hero              | `td-cover-block` with bg image + dark overlay + centered content + `btn-lg btn-primary/btn-secondary`    | Generic gradient             | **Use cover-block**                                                                                                                                           |
| CNCF callout      | On every page (`td-box--secondary`)                                                                      | Missing                      | **Add to every page**                                                                                                                                         |
| Component pattern | Bootstrap `.card` with `border-success` etc. + `text-bg-*` badges                                        | Custom                       | **Adopt** + extend with type stripe                                                                                                                           |
| Theme tokens      | `data-bs-theme` attribute                                                                                | Tailwind v4 only             | **Keep existing `data-theme` attribute, extend to light/dark/auto** (decided 2026-05-06; explorer isn't on Bootstrap, so `data-bs-theme` would be misleading) |

This is visible in the mockup. `DESIGN.md` will be updated to reflect the as-built state in the
Phase 1 cleanup PR (PR 8), once the foundation lands.

---

## What's working in v0 that we keep

- The OTel orange (`#f5a800`) was already aligned — kept as `--color-primary`
- The card hover state (subtle scale + shadow) feels right and translates cleanly into Bootstrap
  card patterns
- The gradient text treatment for hero headlines is a nice signature element worth keeping (now
  using `purple → orange` to match the OTel logo)
- The grid-pattern background overlay for hero sections is a low-cost depth cue worth keeping

## What changes from v0

- **Visual chrome** entirely re-platformed onto Bootstrap 5 + Docsy `td-*` patterns to match
  opentelemetry.io
- **Light theme** added as the default (with dark + auto as toggle options)
- **Brand purple** introduced as `--color-secondary` and used for stats band, brand accents,
  breadcrumb active state
- **Stats** sourced from opentelemetry.io's canonical numbers
- **Signals** corrected to use `Baggage` instead of `Profiles`
- **CNCF incubating project** callout added to every page
- **Footer** restructured to two-cluster Font Awesome layout matching opentelemetry.io
- **Status pill mapping** locked to Bootstrap `text-bg-*` (success/info/warning/danger) for
  portability

---

## Direction: "The Catalog" — unchanged in spirit, re-skinned

The recommended direction remains "The Catalog" (treat the explorer like the npm/crates.io of
OpenTelemetry — searchable, comparable, version-aware). The improvements borrowed from "Atlas"
(pipeline diagrams) and "Dashboard" (version timeline + diff) are still in play. What's new is that
all of it now lives inside the visual frame of opentelemetry.io.

---

## Page-by-page spec

### 1. Explorer home page

**Goal:** answer "what is this site, and what's in it?" in five seconds. Look unmistakably like a
sub-page of opentelemetry.io.

**Layout (top to bottom):**

1. **Always-dark Docsy navbar** — Docs · Ecosystem (active) · Status · Community · Training · Blog ·
   search · lang · theme toggle.
2. **Sub-nav** for the explorer (breadcrumb-only on the home page).
3. **Cover-block hero** — radial gradient + grid pattern background, OTel logo mark, "OpenTelemetry
   Ecosystem Explorer" gradient headline, lead copy, two CTAs (`btn-lg` primary orange +
   outline-light), and a glass-effect ⌘K-able global search input with chips.
4. **Stats band** (`box-primary`, OTel purple) — "12+ Languages · 200+ Collector Components · 1005+
   Integrations · 102+ Vendors". Numbers link out to relevant pages, matching opentelemetry.io's
   pattern exactly.
5. **Ecosystems grid** — Collector and Java Agent as primary cards (with stability pill, count,
   latest version, "updated this week"), plus dashed "coming soon" cards for Python, Go, JS, .NET.
6. **Browse by signal** — four signal cards (Traces / Metrics / Logs / Baggage) matching
   opentelemetry.io's homepage.
7. **Recent activity** rail — last-30-days feed with status pills and ecosystem labels.
8. **CNCF callout** + Docsy footer.

**Why this beats the placeholder:** the visitor sees scale (canonical numbers) and recency above the
fold, plus a global search. The page chrome is indistinguishable from opentelemetry.io.

### 2. Individual ecosystem landing

**Goal:** orient a user to _this_ project, then send them to the list with sensible defaults.

**Layout:**

1. **Sub-nav with breadcrumbs**: `Explorer › Ecosystems › Collector`.
2. **Cover-block hero** — eyebrow, gradient title, description, three CTAs (Browse, Read overview,
   GitHub), and a "Latest release" card on the right with `+4 added · 12 changed · 2 deprecated`
   deltas.
3. **Pipeline anatomy** — five clickable stage cards (Receivers 98 → Processors 42 → Exporters 76 →
   Connectors 14 + Extensions 35), each as a one-click filter into the list. Color stripes on the
   indicator dots match the type-stripe taxonomy.
4. **Quick entry** — three cards (Most-used components · Core vs. Contrib · Diff across versions).
5. **CNCF + footer.**

### 3. List pages

**Goal:** make 200+ components actually browseable.

**Layout:**

- **Sub-nav with breadcrumbs.**
- **Page header**: gradient title, result count, view toggle (Cards / Compact / Table — Compact is
  default), sort dropdown.
- **Active filter chips** as Bootstrap `badge text-bg-secondary rounded-pill` with × dismiss.
- **Left-rail facets** (Bootstrap form): Search · Type (with color-stripe indicators) · Signal ·
  Stability · Distribution (core/contrib) · Version. Each facet shows count alongside the label.
- **Compact result list** in a `.card` with grid rows:
  `[type-stripe | name + slug + description | type | signals | stability pill]`, alternating row
  backgrounds, sticky header, Bootstrap pagination footer.
- **URL-persisted filter state** (`?type=receiver&signal=traces&distribution=contrib`).

**Status-pill mapping (locked):** `stable=text-bg-success`, `beta=text-bg-info`,
`alpha=text-bg-warning`, `unmaintained|deprecated=text-bg-danger`.

**Type stripe (4px left edge):** receiver=info-blue, processor=purple, exporter=orange,
connector=pink, extension=teal.

### 4. Component detail page

**Goal:** be the canonical page for a component — overview, configuration, and what changed across
versions.

**Layout (three-pane):**

- **Sub-nav with full breadcrumbs**: `Explorer › Collector › Receivers › Kafka Receiver`.
- **Left rail (sticky):** sibling navigator (98 receivers, with current highlighted in OTel
  orange) + on-page anchor links.
- **Center column:**
  - Header card with type stripe + eyebrow + title + slug + stability pill + version + signal
    badges + GitHub/Docs links.
  - **"Where this fits"** mini-pipeline diagram showing the component placed inside a typical
    pipeline.
  - Tabbed content area (Bootstrap `nav-tabs`): **Configuration** (Bootstrap striped table with
    Key/Type/Default/Description), **README**, **Emitted attributes**, **Examples**.
- **Right rail (sticky):**
  - **Version history timeline** — vertical timeline with current version highlighted in green,
    per-version changes summarized, with a `Compare` selector and a "Diff →" link.
  - **Compatibility card** — Min collector, Min Go, Distribution, License.

**Empty/error states:** spec four — _not yet released for this version_, _deprecated/removed_,
_missing data_, _no docs yet_. Each gets a designed empty state, not a stack trace.

---

## Cross-cutting principles

1. **Continuity with opentelemetry.io is the spine.** Every component should look at home if dropped
   into the parent site.
2. **Light + dark parity.** No dark-only components. No light-only components. The theme toggle
   (persisted to `td-color-theme` in `localStorage`) flips both.
3. **Density toggles, not redesigns.** Every list view remembers the user's last density choice.
4. **URL is the state.** Every filter, sort, and tab is reflected in the URL so links are shareable.
5. **Status legibility before everything else.** Stability and distribution should be perceivable in
   <300ms scanning.
6. **One small diagram beats one paragraph.** Pipeline diagrams on the ecosystem landing and detail
   pages do more than 200 words of intro copy.
7. **Empty states are first-class.** "Component missing in this version" is information, not an
   error.
8. **CNCF on every page.** Non-negotiable — opentelemetry.io shows it everywhere and we need to
   match.

---

## Suggested sub-issues to break out of #84

If this lands well, the work splits naturally:

- [ ] Theme system — extend the existing `data-theme` attribute to light/dark/auto, persist to
      `td-color-theme`, write contrast tests for both themes
- [ ] Navbar component — match opentelemetry.io structurally and visually; add explorer-specific
      sub-nav
- [ ] Footer component — Docsy two-cluster pattern with Font Awesome icons
- [ ] CNCF callout — reusable component on every route
- [ ] Stats band — fed from a single source of truth synced with the canonical numbers on
      opentelemetry.io
- [ ] Home page — hero (cover-block) + global search + recent activity
- [ ] Ecosystem landing — pipeline anatomy diagram (reusable component)
- [ ] List page — facet rail + density toggle + URL state + chip system
- [ ] Detail page layout — three-pane shell + sibling navigator
- [ ] Detail page — embedded README/config-table renderer (Bootstrap striped tables)
- [ ] Detail page — version timeline + diff view
- [ ] Status-pill / type-stripe mapping spec → defined in this brief; will land in `DESIGN.md` via
      the Phase 1 cleanup PR
- [ ] Empty/error state library (4 patterns)

Each is small enough for one contributor to own.

---

## Mockup

A static, clickable HTML prototype with all four pages (Home / Ecosystem / List / Detail) and a
top-bar switcher is included as `ecosystem-explorer-v1-mockups.html`. It uses Bootstrap 5 + Font
Awesome (matching opentelemetry.io's stack) and supports the same theme toggle pattern. Open in a
browser, click between the four tabs, and toggle the theme to see both modes.

## Open questions

- Should the explorer's home-page **search bar** actually search across ecosystems, or just be a
  launcher into per-ecosystem search?
- For the **detail page version diff**, do we have the underlying data (per-version config schemas,
  deprecation markers) in `ecosystem-registry`/`ecosystem-automation` already, or is that a
  data-pipeline prerequisite?
- Status terminology in the data is currently mixed (`alpha`/`beta`/`development`/`unmaintained`).
  Worth aligning to one taxonomy before locking pill colors.
