---
title: "Plan: v1 redesign architecture improvements"
issue: 84
type: plan
phase: meta
status: planning
last_updated: "2026-09-07"
---

## Plan: v1 redesign architecture improvements

[Open the visual report](https://htmlpreview.github.io/?https://github.com/vitorvasc/opentelemetry-ecosystem-explorer/blob/docs/84-v1-architecture-review-post-merge/projects/84-ui-ux-design/v1-architecture-review.html)
· [HTML source](./v1-architecture-review.html)

Status: proposed, no implementation. Reviewed HEAD `e7162008`, 7 September 2026. Second pass after
layout merge #1048.

Start with **C01: preserve Collector release context**. Historical routes, row links and source
links currently disagree about the release being viewed. Keep the browser-confirmed mobile geometry
and route metadata defects in the first correction batch.

### What changed in the second pass

| Review update          | Evidence                                                                                                                                      | Effect on the plan                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Baseline               | Updated upstream main e7162008; layout merge #1048; all 116 v1 files unchanged.                                                               | Keep the twelve candidate IDs and the same document paths.                                                  |
| New: theme             | Manual selection and OS-driven dark utilities disagree in actual rendered badges.                                                             | Expand C09 to resolved-theme ownership; raise priority to P1.                                               |
| New: list state        | Clear all during an uncommitted 250ms search debounce is undone by the delayed query.                                                         | Strengthen C02 with a browser reproduction.                                                                 |
| New: failure semantics | An injected 503 for a known-present snapshot is reported as a missing registry entry.                                                         | Extend C12 route loading/error verification.                                                                |
| New: acceptance        | Branch naming selects app mode while baseline/scenarios assume v1.                                                                            | C10 must own app mode and scenario compatibility.                                                           |
| Retracted              | The successful-empty-version claim is unreachable because both version loaders reject empty arrays.                                           | Remove it as a defect; keep the valid one-release null-delta case at P2.                                    |
| Qualified              | Metadata mapping-only and empty-bucket cases are synthetic; none occurred in 512 inspected snapshots. Closed-dropdown navigation is unproven. | Keep meaningful edge tests and explicit scope choices; do not present them as observed production failures. |
| Vocabulary             | Two consumers are not automatically adapters; screenshot and axe are complementary operations.                                                | Clarify real seams and avoid adding indirection to satisfy a diagram.                                       |
| Measurements           | Collector 0.160.0 / Java 2.31.1; 526 latest entries + 8 pages; 7 Collector manifests / 94,067 bytes.                                          | Update cost structure; continue to require a benchmark before optimization.                                 |

- Second review at HEAD e7162008 from upstream/main, on docs/84-v1-architecture-review-post-merge.
  Layout work merged as de77130f (#1048). The previous review at 01d889a0 remains the historical
  comparison point.
- Coverage: all 116 src/v1 files individually revalidated against the first pass, with
  byte-identical tree content; fresh critical traces reviewed the same modules plus changed shared
  code, lockfile, generated data and acceptance workflows. 35 v1 test files and 25 CSS files remain
  in scope. The tree contains 16,078 lines.
- No CONTEXT.md or docs/adr directory exists in this checkout. Domain language comes from the
  architecture documentation and existing code; decisions come from v1-routing-pivot.md and
  NEXT-STEPS.md.
- Source assertions and local browser reproductions are distinguished from optimization hypotheses.
  No production latency, bundle-size, full-screen visual parity or comprehensive WCAG audit is
  claimed.
- This branch publishes the same plan and visual report filenames. Application and registry
  implementation remain unchanged; improvements are proposed for later selection.

### Proposed sequence

| Step | Outcome                                           | Candidates                     | Work and exit condition                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Verify failures and unresolved behavior contracts | C01–C05, C08–C09, C11–C12      | Add route/interaction cases for release preservation, pending-search clearing, focused drawer editing/resize, comparison scope, one-release absence semantics, mobile geometry, manual theme versus OS, composing Enter, metadata and truthful fetch errors. Keep each behavior fix narrow. |
| 2    | Remove policy duplication                         | C02, C04–C07, C09              | Concentrate browse transitions, status meaning, summary policy, Java matching and menu behavior; align resolved-theme ownership and remove the dead mirror. Replace redundant implementation tests only after equivalent observable coverage exists.                                        |
| 3    | Make acceptance evidence reliable                 | C10 + validation of 1–2        | Make readiness failures explicit, stabilize selected fixtures/time, cover interactive mobile/theme/locale states and publish axe artifacts. Preserve informational pixel diffs.                                                                                                             |
| 4    | Measure before performance work                   | Performance table; C02/C05/C11 | Record cold/warm request counts, transferred bytes, time to useful content and repeat-query/filter CPU on current catalogs plus representative growth. Optimize the proven expensive path and compare the same scenarios.                                                                   |
| 5    | Reconcile capabilities and cutover debt           | C12 + historical ledger        | Update current-state docs, settle README/telemetry/feature-gate/diff scope and data-owned deferrals, then prepare the separately authorized end-of-redesign cleanup. No deployment or cutover is included in this review.                                                                   |

### Categorized candidates

| ID  | Priority            | Strength        | Category                                        | Candidate                                       |
| --- | ------------------- | --------------- | ----------------------------------------------- | ----------------------------------------------- |
| C01 | P1                  | Strong          | Correctness · maintainability                   | Preserve Collector release context              |
| C02 | P1                  | Strong          | Duplication · correctness · performance         | Deepen list filter transitions                  |
| C03 | P1                  | Strong          | Accessibility · maintainability                 | Stabilize the responsive drawer lifecycle       |
| C04 | P2                  | Strong          | Correctness · duplication · localization        | Preserve Collector metadata meaning             |
| C05 | P2                  | Strong          | Correctness · maintainability · performance     | Own catalog summary state and provenance        |
| C06 | P2                  | Strong          | Duplication · maintainability                   | Give Java Agent browse matching one owner       |
| C07 | P2                  | Strong          | Duplication · accessibility · localization      | Deepen preference menus                         |
| C08 | P1                  | Strong          | Correctness · CSS duplication · maintainability | Own chrome and section geometry                 |
| C09 | P1                  | Strong          | Correctness · maintainability · deletion        | Align every theme path with the selected mode   |
| C10 | P2                  | Strong          | Test locality · maintainability                 | Deepen browser acceptance around visible states |
| C11 | P2 / P3             | Worth exploring | Correctness · maintainability · performance     | Make search interaction and ranking coherent    |
| C12 | P1 / reconciliation | Strong          | Correctness · feature parity · maintainability  | Complete the v1 route integration contract      |

### C01: Preserve Collector release context

Recommendation: Strong · P1 · Correctness · maintainability · in-process.

Files: [ecosystem-explorer/src/v1/V1App.tsx:126](../../ecosystem-explorer/src/v1/V1App.tsx#L126),
[ecosystem-explorer/src/v1/features/list/list-page.tsx:95](../../ecosystem-explorer/src/v1/features/list/list-page.tsx#L95),
[ecosystem-explorer/src/v1/features/detail/detail-page.tsx:123](../../ecosystem-explorer/src/v1/features/detail/detail-page.tsx#L123),
[ecosystem-explorer/src/v1/components/detail/tabs.tsx:76](../../ecosystem-explorer/src/v1/components/detail/tabs.tsx#L76),
[ecosystem-explorer/src/v1/components/detail/version-timeline.tsx:112](../../ecosystem-explorer/src/v1/components/detail/version-timeline.tsx#L112).

**Problem:** Release and location policy leaks across list, detail, source-link and tab modules.

**Proposed improvement:** Concentrate release resolution and router-aware location policy,
preserving canonical paths and deprecated behavior while deciding how latest source links should
behave.

- Browser-confirmed: /collector/components/0.154.0 displays the default/latest selection because the
  list reads only query parameters.
- Ordinary row links omit the selected version; sibling links preserve it.
- Browser-confirmed: forwardconnector?version=0.154.0 links to GitHub tree/main because sourceHref
  receives a version only for deprecated entries.
- Detail writes window.history.replaceState(null, …), while tabs separately read
  window.location/hashchange; same-route hash changes need a real router test.

**Before:** Historical path → latest list → Historical row → latest detail → Historical detail →
source main → Router + separate tab hash state.

**After:** Collector release-context module → Resolve release once → Preserve it through navigation
→ Router owns location changes.

**Benefits:** locality: release rules stay together; leverage: every link preserves context; depth:
callers forget precedence rules.

**Seam and adapter:** The navigation interface is the seam; use the existing router and browser
history together. They are cooperating mechanisms, not interchangeable adapters by definition. No
general URL framework.

**Deletion test:** Deleting the deep module would redistribute release and location rules across
rows, siblings, tabs, timeline and source links.

**Validation:** Exercise actual routes: historical path/query entry → row → source link; deprecated
last release; same-route hash navigation and Back/Forward. Decide path/query precedence before
implementation. Preserve any intentional latest-to-main source behavior; historical links need
explicit release semantics.

**Scope:** Medium; keep release preservation and tab synchronization reviewable separately.

### C02: Deepen list filter transitions

Recommendation: Strong · P1 · Duplication · correctness · performance · local-substitutable.

Files:
[ecosystem-explorer/src/v1/lib/list-filters.ts:157](../../ecosystem-explorer/src/v1/lib/list-filters.ts#L157),
[ecosystem-explorer/src/v1/features/list/list-page.tsx:174](../../ecosystem-explorer/src/v1/features/list/list-page.tsx#L174),
[ecosystem-explorer/src/v1/components/list/controls.tsx:66](../../ecosystem-explorer/src/v1/components/list/controls.tsx#L66),
[ecosystem-explorer/src/v1/components/list/facet-panel.tsx:142](../../ecosystem-explorer/src/v1/components/list/facet-panel.tsx#L142),
[ecosystem-explorer/src/v1/components/list/facets.tsx:134](../../ecosystem-explorer/src/v1/components/list/facets.tsx#L134).

**Problem:** The parser is shared, but callers independently own resets, clearing, persistence and
query synchronization.

**Proposed improvement:** Give the list-state module ownership of transition rules and URL/storage
precedence, keeping result derivation separate from page and density changes.

- Browser-confirmed after merge: enter kafka with an empty URL query and a receiver chip, then click
  Clear all in 176ms; the pending 250ms debounce restores ?q=kafka after the clear.
- Facet edits reset page; removing chips does not.
- Chip Clear all removes version; empty-state Clear all retains it and does not count version as an
  active filter.
- Compact density is omitted from shared URLs, allowing a saved table/cards preference to change the
  view. Exact-view sharing and remembered preferences are both documented: their precedence needs an
  explicit decision.
- Filtering and sorting depend on the whole filters object, so page/density changes repeat work.
  This is unnecessary computation, with no measured latency claim.

**Before:** Facet reset policy → Chip reset policy → Empty-state clear policy → URL defaults ↔ saved
density.

**After:** List-state module → One transition policy → Explicit URL/storage precedence → Stable
result-set derivation.

**Benefits:** locality: reset semantics stay together; leverage: all controls share behavior; depth:
smaller caller obligations.

**Seam and adapter:** The list-state interface is the seam. Router and browser storage cooperate in
persistence; use fixture storage at its own seam where substitution is needed. Keep
Collector-specific facets until another redesigned list needs them.

**Deletion test:** Removing the module would recreate transition knowledge in facets, chips, density
controls and the page; extracting one-line helpers alone adds no depth.

**Validation:** Use more than 50 rows; compare checkbox and chip removal on page 2; test both clear
actions with version selected; reload a compact link against saved table density; exercise delayed
search and Back/Forward. Clear while an uncommitted search draft exists but the previous URL query
is empty; the delayed draft must not undo the agreed clear behavior.

**Scope:** Medium; decide exact-view sharing versus remembered defaults explicitly.

### C03: Stabilize the responsive drawer lifecycle

Recommendation: Strong · P1 · Accessibility · maintainability · local-substitutable.

Files:
[ecosystem-explorer/src/v1/components/list/facet-panel.tsx:91](../../ecosystem-explorer/src/v1/components/list/facet-panel.tsx#L91),
[ecosystem-explorer/src/v1/features/list/list-page.tsx:283](../../ecosystem-explorer/src/v1/features/list/list-page.tsx#L283),
[ecosystem-explorer/src/v1/styles/facet-panel.css:25](../../ecosystem-explorer/src/v1/styles/facet-panel.css#L25),
[ecosystem-explorer/src/components/ui/dialog.tsx:16](../../ecosystem-explorer/src/components/ui/dialog.tsx#L16).

**Problem:** A changing close callback restarts focus handling, while CSS switches to a desktop rail
without switching modal behavior.

**Proposed improvement:** Let the drawer module own opening, closing, viewport changes, focus and
scroll locking as one lifecycle.

- Browser-confirmed after merge: selecting a drawer checkbox moves focus to Close after the URL
  update settles. The effect depends on an inline onClose callback, so a filter update tears it down
  and restarts focus entry.
- Browser-confirmed: resizing an open drawer to 1280px leaves role=dialog, aria-modal and body
  overflow=hidden on the desktop rail.
- Focus entry/trap/restore already shipped; the old roadmap item is resolved, while these
  interaction defects remain.

**Before:** Filter change → new callback → Cleanup → restore focus → Restart → focus Close → Desktop
CSS + modal behavior.

**After:** Drawer lifecycle module → Open/close owns focus → Filter edits preserve focus → Viewport
owns rail/modal mode.

**Benefits:** locality: focus lifecycle stays together; leverage: callers pass intent; depth: stable
interaction interface.

**Seam and adapter:** The overlay interface is the seam. The existing dialog adapter is not a direct
replacement: its modal-only assumptions and scroll-restoration behavior need checking against the
persistent desktop rail. Deepen FacetPanel directly if sharing does not remove real complexity.

**Deletion test:** A generic Escape-only module would leave the important complexity spread out;
concentrate the full lifecycle instead.

**Validation:** Open the real list drawer; toggle a focused checkbox; type through debounce; resize
across 992px; close and assert opener focus, body scrolling and appropriate semantics.

**Scope:** Small–medium; preserve the desktop rail and current visual treatment.

### C04: Preserve Collector metadata meaning

Recommendation: Strong · P2 · Correctness · duplication · localization · in-process.

Files:
[ecosystem-explorer/src/v1/features/detail/diff-page.tsx:61](../../ecosystem-explorer/src/v1/features/detail/diff-page.tsx#L61),
[ecosystem-explorer/src/v1/features/detail/detail-page.tsx:78](../../ecosystem-explorer/src/v1/features/detail/detail-page.tsx#L78),
[ecosystem-explorer/src/v1/features/list/list-page.tsx:102](../../ecosystem-explorer/src/v1/features/list/list-page.tsx#L102),
[ecosystem-explorer/src/lib/api/collector-data.ts:45](../../ecosystem-explorer/src/lib/api/collector-data.ts#L45),
[ecosystem-explorer/src/v1/components/detail/detail-header.tsx:43](../../ecosystem-explorer/src/v1/components/detail/detail-header.tsx#L43),
[ecosystem-explorer/src/v1/components/home/recent-activity-rail.tsx:49](../../ecosystem-explorer/src/v1/components/home/recent-activity-rail.tsx#L49),
[ecosystem-explorer/src/components/ui/status-pill.tsx:22](../../ecosystem-explorer/src/components/ui/status-pill.tsx#L22).

**Problem:** Repeated status projections can disagree, and the broad no-change message hides the
narrower meaning of the live comparison.

**Proposed improvement:** Concentrate status interpretation and presentation; explicitly decide
whether comparison preserves per-signal stability changes or describes its narrower supported scope.

- Synthetic edge case: promoting traces from alpha to beta while both level sets and signal unions
  stay unchanged produces No metadata changes. The implementation deliberately compares
  declared-level sets, while its header promises per-signal transitions.
- List, detail and shared data code repeat stability ranking; empty signal buckets could disagree.
  No empty buckets or mapping-only adjacent transitions were found across 512 local Collector
  snapshots; these are valid edge cases, not current-catalog observations.
- Detail, activity and facets repeat labels/colors; detail pill styling lives in the home activity
  stylesheet.
- StatusPill already localizes six supported levels. Activity also requires new and unknown
  raw-status fallback; preserve those cases.

**Before:** Three status projections → Independent pill/label maps → Diff: level set + signal union
→ Detail depends on home CSS.

**After:** Collector metadata module → Agreed comparison scope → Shared status presentation →
Truthful change summaries.

**Benefits:** locality: status meaning stays together; leverage: consistent list and detail; depth:
tests exercise meaningful changes.

**Seam and adapter:** Keep focused projection, presentation and comparison interfaces. Index records
and full snapshots are data shapes, not automatically adapters. Existing loaders provide the data
seam; tests use controlled snapshots.

**Deletion test:** Deleting useful projection/presentation behavior would scatter ranking, labels
and colors across callers; deleting duplicate maps removes synchronization work.

**Validation:** Render a promotion that preserves both sets; test all six levels, mixed/empty
buckets, list/detail agreement, Spanish labels and unknown activity status. Keep schema absence
explicit. Use the synthetic mapping-only case to settle scope; keep metric/attribute differences
distinct from deferred configuration schemas.

**Scope:** Medium; settle comparison scope and no-change wording separately from presentation
consolidation.

**Recorded decision:** Resolve the mismatch between the broad no-change claim and intentionally
narrow level-set comparison. Do not silently expand the agreed comparison scope.

### C05: Own catalog summary state and provenance

Recommendation: Strong · P2 · Correctness · maintainability · performance · ports & adapters.

Files:
[ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.tsx:98](../../ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.tsx#L98),
[ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.ts:94](../../ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.ts#L94),
[ecosystem-explorer/src/v1/features/ecosystem/collector-config.tsx:20](../../ecosystem-explorer/src/v1/features/ecosystem/collector-config.tsx#L20),
[ecosystem-explorer/src/v1/components/home/ecosystems-grid.tsx:49](../../ecosystem-explorer/src/v1/components/home/ecosystems-grid.tsx#L49),
[ecosystem-explorer/src/v1/components/home/signals-row.tsx:35](../../ecosystem-explorer/src/v1/components/home/signals-row.tsx#L35),
[ecosystem-explorer/src/v1/lib/home-stats.ts:20](../../ecosystem-explorer/src/v1/lib/home-stats.ts#L20).

**Problem:** Meaningful absence becomes mock data, while authored global figures and live catalog
facts have unclear refresh ownership.

**Proposed improvement:** Deepen summary resolution around live facts, absence and approved error
snapshots; document provenance before connecting further home metrics.

- Valid one-release edge case: the hook returns deltas=null, but the page displays authored +4 / 12
  / 2. The current catalog has seven releases, so this is not its ordinary successful state.
- Correction to the first review: empty version arrays are rejected by both real version loaders and
  cache validation. They follow the approved error fallback; there is no reachable
  successful-empty-version defect.
- Current counts/version wait for historical delta requests; one historical failure discards
  otherwise available facts.
- Home grid still names Collector v0.150.0 and Java Agent v2.10.0; current catalogs contain 0.160.0
  and 2.31.1. Stats totals 275/269 count across versions, while latest indexes contain 267/259;
  these facts must remain distinct.

**Before:** Current facts + history Promise → null → authored mock deltas → Authored catalog
snapshot ≠ current facts → Global totals mixed with catalog facts.

**After:** Catalog summary module → Live / absent / fallback meaning → Explicit fact provenance →
Optional historical enrichment.

**Benefits:** locality: fallback policy stays together; leverage: both landing routes agree; depth:
rendering consumes resolved meaning.

**Seam and adapter:** Existing Collector and Java Agent data adapters occupy the summary seam. Reuse
the current cache; do not add another fetch framework or prescribe new interface types.

**Deletion test:** Deleting page-level fallback duplication concentrates policy; deleting the deep
module would restore copied snapshot and absence decisions.

**Validation:** Use the real hook with controlled loaders: one/two releases, missing stage, failed
history, rejected empty versions and Java version-only behavior. Assert the approved fallback and
the meaning of absent optional deltas.

**Scope:** Medium. Correct null semantics now; independent partial success and replacing authored
home metrics need explicit product choices.

**Recorded decision:** Preserve the June 2026 static-on-error decision. Partial-success presentation
is a separate proposal; no registry files are edited.

### C06: Give Java Agent browse matching one owner

Recommendation: Strong · P2 · Duplication · maintainability · in-process.

Files:
[ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.ts:143](../../ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.ts#L143),
[ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.tsx:46](../../ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.tsx#L46),
[ecosystem-explorer/src/features/java-agent/java-instrumentation-list-page.tsx:174](../../ecosystem-explorer/src/features/java-agent/java-instrumentation-list-page.tsx#L174).

**Problem:** The count-equals-destination promise relies on two separately maintained substring
predicates.

**Proposed improvement:** Deepen the Java Agent browse module so landing counts and destination
results use the same matching meaning.

- The landing hook and instrumentation list separately lowercase and match name, display_name and
  description.
- The landing recovers a search term from each href, but tests never click through and compare the
  destination count.
- Cross-ecosystem search also ranks keywords and intentionally has different semantics.

**Before:** Stage href → Landing predicate A → count → List predicate B → results.

**After:** Java Agent browse module → One matching policy → Landing count + destination results.

**Benefits:** locality: predicate changes once; leverage: counts match destinations; depth: one
behavioral interface.

**Seam and adapter:** The browse interface is the seam; existing data-loading adapters remain
unchanged. No hypothetical generic ecosystem adapter.

**Deletion test:** Removing the repeated private predicate deletes duplicated policy; deleting the
shared behavior would recreate it in both callers.

**Validation:** Click every category over one controlled dataset; compare tile count and list total
for name-only, description-only, case and zero-match cases.

**Scope:** Small; preserve existing search query vocabulary and substring-defined categories.

### C07: Deepen preference menus

Recommendation: Strong · P2 · Duplication · accessibility · localization · local-substitutable.

Files:
[ecosystem-explorer/src/v1/components/ui/theme-toggle.tsx:39](../../ecosystem-explorer/src/v1/components/ui/theme-toggle.tsx#L39),
[ecosystem-explorer/src/v1/components/ui/language-toggle.tsx:43](../../ecosystem-explorer/src/v1/components/ui/language-toggle.tsx#L43),
[ecosystem-explorer/src/v1/styles/theme-toggle.css:69](../../ecosystem-explorer/src/v1/styles/theme-toggle.css#L69),
[ecosystem-explorer/src/v1/styles/language-toggle.css:78](../../ecosystem-explorer/src/v1/styles/language-toggle.css#L78).

**Problem:** Theme and language repeat menu behavior/styles but expose different selection semantics
and English control copy.

**Proposed improvement:** Concentrate selected state, keyboard behavior, translated control labels
and shared portal styles in a preference-menu module.

- Language uses RadioGroup/RadioItem; theme uses ordinary Item plus data-active, so its selected
  option is not announced as checked.
- Theme option/trigger text and the language trigger remain hardcoded English.
- Both menus import raw Radix and independently maintain portal surfaces, hover states, caret and
  mobile treatment; recent parity fixes touched both.

**Before:** Theme: duplicated menu + CSS → Language: duplicated menu + CSS → Different checked-state
behavior.

**After:** Theme + language consumers → Preference-menu module → Shared selection and chrome
behavior.

**Benefits:** locality: menu behavior stays together; leverage: upstream fixes apply twice; depth:
smaller menu interface.

**Seam and adapter:** Theme and language are two consumers with real shared selection behavior, not
interchangeable adapters merely because there are two. Radix supplies the existing interaction
adapter at the menu seam; preserve endonyms, alignment, icons and intentional checked-state styling.

**Deletion test:** Deleting the proposed module would redistribute keyboard, portal and
checked-state knowledge; avoid a general design-system factory.

**Validation:** Both menus announce one checked choice; keyboard selection/Escape restores focus;
Spanish control labels update; persistence and auto theme remain correct.

**Scope:** Small–medium; add the shared styled primitive in the documented UI location.

### C08: Own chrome and section geometry

Recommendation: Strong · P1 · Correctness · CSS duplication · maintainability · in-process.

Files: [ecosystem-explorer/src/v1/V1App.tsx:101](../../ecosystem-explorer/src/v1/V1App.tsx#L101),
[ecosystem-explorer/src/v1/styles/navbar.css:175](../../ecosystem-explorer/src/v1/styles/navbar.css#L175),
[ecosystem-explorer/src/styles/base.css:28](../../ecosystem-explorer/src/styles/base.css#L28),
[ecosystem-explorer/src/v1/styles/home.css:35](../../ecosystem-explorer/src/v1/styles/home.css#L35),
[ecosystem-explorer/src/v1/styles/signals-row.css:28](../../ecosystem-explorer/src/v1/styles/signals-row.css#L28),
[ecosystem-explorer/src/v1/styles/recent-activity-rail.css:32](../../ecosystem-explorer/src/v1/styles/recent-activity-rail.css#L32).

**Problem:** Fixed chrome, route clearance and section spacing are independently owned, producing
overlap and specificity conflicts.

**Proposed improvement:** Concentrate fixed-chrome geometry and shared section rhythm in their
respective layout modules, assigning each outer spacing decision once.

- Browser at 390px: navbar bottom=104px, main padding=64px, breadcrumb top=64px and bottom=105px;
  most of the breadcrumb is covered.
- Global scroll-padding-top is 80px, less than the mobile fixed navbar.
- The home section[aria-label] selector overrides muted-box padding; SignalsRow then adds its own
  outer padding beside the unpadded activity rail.
- Subsection title/lead rules are repeated in signal and activity styles.

**Before:** Navbar 104 · main64 · anchors80 → ARIA selector controls spacing → Shared box + nested
outer padding.

**After:** Chrome geometry module → Section layout module → One owner per spacing decision.

**Benefits:** locality: viewport rules stay together; leverage: every route clears chrome; depth:
layout interface expresses role.

**Seam and adapter:** Desktop/mobile styling and standalone/co-mounted sections are real variants at
the layout seam. A JavaScript measurement adapter is unnecessary for the current fixed geometry.

**Deletion test:** Removing duplicated offsets and the placeholder selector eliminates coordination
work; do not create a universal card module.

**Validation:** Browser bounding boxes and anchor destinations at mobile/desktop; open/closed
navbar; aligned signal/activity headings in both themes; label changes must not alter layout.

**Scope:** Small; keep chrome geometry and section spacing in separate reviewable changes.

### C09: Align every theme path with the selected mode

Recommendation: Strong · P1 · Correctness · maintainability · deletion · in-process.

Files:
[ecosystem-explorer/src/theme-context.tsx:77](../../ecosystem-explorer/src/theme-context.tsx#L77),
[ecosystem-explorer/src/styles/index.css:16](../../ecosystem-explorer/src/styles/index.css#L16),
[ecosystem-explorer/src/components/ui/glow-badge.tsx:39](../../ecosystem-explorer/src/components/ui/glow-badge.tsx#L39),
[ecosystem-explorer/src/themes.ts:82](../../ecosystem-explorer/src/themes.ts#L82),
[ecosystem-explorer/src/themes.test.ts:32](../../ecosystem-explorer/src/themes.test.ts#L32),
[ecosystem-explorer/src/styles/tokens.css:99](../../ecosystem-explorer/src/styles/tokens.css#L99).

**Problem:** Theme selection controls CSS tokens while dark utilities follow OS preference, and an
unused palette mirror creates a third source of theme knowledge.

**Proposed improvement:** Give the theme module one resolved-mode meaning across tokens and
utilities, then delete the unused palette records while retaining needed theme vocabulary.

- Browser-confirmed across all four OS/selected-theme pairs: stable badge text changes with OS
  preference even when the selected theme stays fixed; page surfaces correctly follow the selected
  theme.
- Compiled current CSS places dark:text-green-400 under prefers-color-scheme: dark; ThemeProvider
  writes data-theme and no custom dark variant connects the two.
- Selected Light + OS Dark renders the light-mode surface with green-400 text; selected Dark + OS
  Light uses green-800 on the dark surface. Palette disagreement is verified; no full WCAG audit is
  claimed.
- The themes object and DEFAULT_THEME are only used by their tests; runtime needs ResolvedThemeId.
  Light palette values disagree with emitted CSS, while tests check the unused mirror’s shape.

**Before:** Selected mode → CSS surfaces → OS mode → dark utilities → Unused TypeScript palette +
tests.

**After:** Resolved-theme module → Tokens + utilities follow selection → System preference applies
in Auto → Remove unused palette mirror.

**Benefits:** locality: one resolved-theme meaning; leverage: badges follow user preference; depth:
verify the rendered interface.

**Seam and adapter:** Keep the theme interface authoritative across the styling seam. matchMedia
supplies system preference; persistence supplies the chosen mode. Test stand-ins belong at those
existing seams, without creating a new palette adapter.

**Deletion test:** Deleting duplicate palette records is simplification, not depth by itself. The
deepening comes from removing caller knowledge about competing theme mechanisms and testing actual
rendered behavior.

**Validation:** Exercise OS Light/Dark crossed with chosen Light/Dark, plus Auto and persistence;
inspect computed styles on real StatusPill/GlowBadge consumers. Existing OS-only screenshots and
class-string tests miss the split.

**Scope:** Small–medium. Align mode selection while preserving intentionally distinct upstream
chrome palettes; remove dead constants in a separate reviewable cleanup.

### C10: Deepen browser acceptance around visible states

Recommendation: Strong · P2 · Test locality · maintainability · local-substitutable.

Files:
[ecosystem-explorer/scripts/take-screenshots.mjs:159](../../ecosystem-explorer/scripts/take-screenshots.mjs#L159),
[ecosystem-explorer/scripts/generate-test-config.mjs:32](../../ecosystem-explorer/scripts/generate-test-config.mjs#L32),
[ecosystem-explorer/src/v1/features/_dev/components-page.tsx:89](../../ecosystem-explorer/src/v1/features/_dev/components-page.tsx#L89),
[.github/workflows/screenshots-capture.yml:95](../../.github/workflows/screenshots-capture.yml#L95).

**Problem:** A screenshot can be named for a state that never loaded, and default desktop scans miss
important interactive states.

**Proposed improvement:** Concentrate scenario readiness, interactions and outputs in an acceptance
module, with deterministic data/time and real-page interaction checks.

- clickTab swallows failures and callers ignore its result; readiness is permissive.
- Axe normally runs only at the first desktop viewport, apart from the facet drawer; preference
  menus/mobile navbar are not opened and locale is not a scenario dimension.
- Axe JSON is not uploaded by the capture workflow; pixel diffs are explicitly informational.
- The showcase repeats conflicting type colors and mounts live stats/activity. Its base-CTA demo is
  legitimate, but the current large-CTA variant lacks explicit coverage; registry/time changes can
  create unrelated diffs.
- New workflow finding: screenshot capture chooses v1 only for feat/84-* branches, but its baseline
  and mobile Open filters scenario assume v1. A nonmatching branch with add-screenshots can capture
  legacy chrome and then fail the v1-only drawer step.

**Before:** Route script + permissive waits → Default-state screenshots → Live data and drifting
fixtures → Axe counts in logs.

**After:** Observable scenario module → Explicit app mode + readiness → Capture and audit operations
→ Controlled data + live smoke coverage.

**Benefits:** locality: readiness rules stay together; leverage: new routes reuse verification;
depth: outputs prove intended state.

**Seam and adapter:** Screenshot capture and axe auditing are complementary operations behind the
acceptance interface, not substitutable adapters. Deterministic fixture data and live data form a
real seam. Make app mode and scenario requirements explicit.

**Deletion test:** Removing duplicated navigate/settle/capture and local server setup concentrates
policy; a pass-through goto helper would be shallow.

**Validation:** A missing tab/readiness condition must fail that scenario; verify mobile focus flows
and locale states; publish actionable axe output; preserve a small real-data smoke set. Verify v1
and legacy scenario compatibility independently of branch naming, including a non-feat/84 branch.

**Scope:** Medium; use a risk-based scenario matrix, not every Cartesian combination.

**Recorded decision:** Preserve the documented informational pixel-diff policy. A future blocking
accessibility gate needs an explicit decision.

### C11: Make search interaction and ranking coherent

Recommendation: Worth exploring · P2 / P3 · Correctness · maintainability · performance ·
local-substitutable.

Files:
[ecosystem-explorer/src/v1/components/home/global-search.tsx:193](../../ecosystem-explorer/src/v1/components/home/global-search.tsx#L193),
[ecosystem-explorer/src/v1/hooks/use-search.ts:20](../../ecosystem-explorer/src/v1/hooks/use-search.ts#L20),
[ecosystem-explorer/src/lib/search/search-index.ts:63](../../ecosystem-explorer/src/lib/search/search-index.ts#L63),
[ecosystem-explorer/src/lib/search/matching.ts:30](../../ecosystem-explorer/src/lib/search/matching.ts#L30).

**Problem:** Open state, query freshness and selection policy are separately derived, while matching
repeats normalization during sorting.

**Proposed improvement:** Fix composing-Enter handling first; deepen interaction policy only where
it removes duplicated state rules, then benchmark prepared text and per-query ranking.

- Enter navigation lacks an IME composition guard. Missing isOpen gating alone is not a reproduced
  closed-dropdown defect: closing clears query results and Escape blurs the input.
- Old results remain selectable during the 200ms debounce before the loading flag changes; define
  intended stale-result behavior.
- The sort comparator repeatedly normalizes title/description/keywords after filtering already did
  similar work.
- There are 526 latest catalog entries plus eight static pages. Repeated normalization is proven;
  user-visible slowness is not. The shared Java source now emits the canonical version-query route.

**Before:** query / debounce / loading / open → Selection uses separate conditions → Filter
normalize + repeated sort ranks.

**After:** Coherent search interaction module → Explicit selectable-result meaning → Measured
ranking optimization.

**Benefits:** locality: selection rules stay together; leverage: keyboard and pointer agree; depth:
tests exercise user interaction.

**Seam and adapter:** The current search engine and its three source adapters already earn their
seam. Keep the existing interface; no generic single-caller combobox or backend search framework.

**Deletion test:** Removing useSearch would push cancellation/lifecycle into the view, so it earns
its place. Remove repeated normalization only when measured benefit warrants it.

**Validation:** Composing Enter must not navigate; verify close/reopen, out-of-order promises,
Ctrl+K and Cmd+K separately, ranking ties and partial-source retry. Keep close/reopen as regression
coverage rather than asserting ordinary closed-input navigation is broken.

**Scope:** Small for the IME fix; medium only if interaction complexity or benchmarks justify deeper
work.

### C12: Complete the v1 route integration contract

Recommendation: Strong · P1 / reconciliation · Correctness · feature parity · maintainability ·
local-substitutable.

Files:
[ecosystem-explorer/src/v1/features/list/list-page.tsx:168](../../ecosystem-explorer/src/v1/features/list/list-page.tsx#L168),
[ecosystem-explorer/src/v1/features/detail/detail-page.tsx:134](../../ecosystem-explorer/src/v1/features/detail/detail-page.tsx#L134),
[ecosystem-explorer/src/v1/features/detail/diff-page.tsx:95](../../ecosystem-explorer/src/v1/features/detail/diff-page.tsx#L95),
[ecosystem-explorer/src/components/seo/seo.tsx:89](../../ecosystem-explorer/src/components/seo/seo.tsx#L89),
[ecosystem-explorer/src/lib/seo/derive.ts:111](../../ecosystem-explorer/src/lib/seo/derive.ts#L111),
[ecosystem-explorer/src/features/collector/collector-detail-page.tsx:194](../../ecosystem-explorer/src/features/collector/collector-detail-page.tsx#L194),
[ecosystem-explorer/src/v1/components/detail/tabs.tsx:33](../../ecosystem-explorer/src/v1/components/detail/tabs.tsx#L33),
[ecosystem-explorer/src/v1/features/detail/detail-page.tsx:178](../../ecosystem-explorer/src/v1/features/detail/detail-page.tsx#L178).

**Problem:** The redesigned Collector pages omit shared metadata behavior and still defer
capabilities that now exist elsewhere in the app.

**Proposed improvement:** Make each route own metadata and truthful loading outcomes, then compose
existing content modules after an explicit v1 parity reconciliation.

- No Seo is rendered by the v1 Collector list, detail or diff page; browser navigation from
  /collector to detail retains the landing title and metadata.
- Legacy detail already uses deriveCollectorMeta; reuse the dependency-free shared derivation
  instead of creating another title table.
- Ordinary v1 README remains an empty state even when markdown_hash exists; the existing renderer is
  used only for deprecated entries.
- Legacy telemetry and feature-gate modules now exist; v1 still exposes a smaller Attributes view.
  Reconcile intended capability before cutover rather than silently deleting working legacy
  behavior.
- Browser-confirmed with an injected 503 for a snapshot whose release presence is known: detail
  renders Component not found and asserts the registry has no entry. Its test currently pins an
  arbitrary fetch error to this absence message.

**Before:** Home/landing update metadata → Collector pages leave old metadata → Live content exists
in legacy tree → Ordinary README placeholder.

**After:** Route integration module → Metadata follows current location → Reuse available content
modules → Explicit parity/deferral ledger.

**Benefits:** locality: route obligations stay visible; leverage: reuse existing content modules;
depth: test through complete routes.

**Seam and adapter:** The shared Seo interface and existing content/data adapters are real seams.
Keep derivation dependency-free across build, browser and edge runtimes.

**Deletion test:** Removing existing content/metadata modules would duplicate behavior; deepening
route composition should absorb obligations, not create forwarding files.

**Validation:** Navigate home → list → detail → diff and assert title/description/canonical
metadata; verify normal/deprecated README; agree telemetry, feature-gate and emitted-attribute diff
acceptance before integrating. Inject a transport failure for a known-present snapshot and
distinguish it from confirmed absence without exposing raw exceptions.

**Scope:** Small for missing metadata; medium for approved content parity. Preserve deferred schema
extraction.

### Performance evidence and plan

| Area             | Observed cost structure                                                                                               | Next evidence / decision                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release presence | 7 manifests, 94,067 bytes uncompressed in this checkout; lookup loads all releases with concurrency 8.                | Measure cold/warm history readiness and navigation churn; only then consider a cached presence projection or generated index. Keep failed request distinct from absent release. |
| Search           | 267 Collector + 259 Java Agent entries, plus 8 static pages; slim index files total 509,264 bytes before compression. | Measure first search and repeat-query CPU; prepare text/ranks if material. Existing source indexes, request coalescing and retry remain.                                        |
| Landing summary  | Current summary waits for optional historical deltas; failures couple unrelated facts.                                | Measure time to useful counts/version; independent enrichment needs a clear partial-success policy.                                                                             |
| List rendering   | 50 rows per page; full result filtering/sorting repeats on page/density changes.                                      | Stabilize result-set derivation first; no evidence currently justifies virtualization or a worker.                                                                              |
| Bundles / CSS    | Both sub-app shells and eager v1 CSS are an accepted migration trade-off; pages are already lazy.                     | No production bundle or interaction benchmark was run. Reassess after scheduled cutover; do not duplicate the planned deletion with a temporary framework.                      |

### Remaining findings and scope decisions

| Category              | Disposition                       | Finding                                                                                                                                      | Proposed handling                                                                                                                          |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation            | Confirmed from route table        | footer.tsx:115,120 links /community/marketing-guidelines/ and /site/ on the explorer origin, which has neither route; tests pin these paths. | Use the intended upstream origin and verify the link inventory; no new navigation framework.                                               |
| Localization          | Still open                        | List-page copy, type/signal display ids, ecosystem breadcrumbs/loading suffix, preference labels and footer “present” remain English.        | Complete existing namespaces and behavior tests; English/Spanish key structures already match, which does not prove all text is localized. |
| Local duplication     | Low cost                          | QuickEntryRow repeats inner markup for internal/external links.                                                                              | Share the local inner content while preserving the two link adapters; avoid a generalized link module.                                     |
| Focus styling         | Partially resolved                | The old footer #f5a800 literals are gone; focus-ring declarations still have multiple owners.                                                | Reconcile semantic focus tokens where identical intent is established; preserve intentional upstream offsets.                              |
| Detail location       | Worth exploring                   | Tabs read window.location/hashchange while the page writes raw history; DiffSelector defaults reset only on mount.                           | Handle location under C01; prove any selector-reset issue on a transition that preserves mounted content before claiming a general defect. |
| Metadata scope        | Needs reconciliation              | Live diff ignores metric/attribute dictionaries; planned emitted-attribute comparison is not the deferred configuration-schema feature.      | Agree the supported comparison scope and add observable examples.                                                                          |
| Recently updated sort | Product/data gap                  | The advertised sort falls back to name because usable timestamps are absent.                                                                 | Do not invent dates; decide whether to hide/label the option or provide real data. It remains a product/data gap.                          |
| Table / mobile detail | Plan-to-implementation gap        | Table headings are not sortable; mobile sibling rail stacks rather than becoming a drawer.                                                   | Reconcile desired behavior before adding scope during refactoring.                                                                         |
| Dormant schema diff   | Deferred risk                     | extractKeys returns []; rename pairing is first-match/order-dependent for identical descriptions; default-value differences are not tracked. | Keep schema capability explicitly deferred. Revisit with a real schema adapter and examples; no optimization of unreachable paths.         |
| Showcase helper       | Low leverage alone                | The Section bare flag and long file are historical cleanup suggestions.                                                                      | Prefer canonical scenarios/fixtures under C10; splitting one boolean or moving JSX alone adds little depth.                                |
| Lint maintenance      | Existing main warnings            | The three new react-refresh suppressions in dialog.tsx, tabs.tsx and tooltip.tsx are now reported unused.                                    | Optional mechanical cleanup; no architecture refactor or diagnostic suppression sweep.                                                     |
| Data-state semantics  | Confirmed with controlled failure | A 503 fetching an existing Collector snapshot is rendered as registry absence.                                                               | C12: retain successful release-presence evidence and distinguish unknown/failed fetch from not-released.                                   |

### Historical findings ledger

| Workstream                                         | Current disposition                           | Current checkout evidence                                                                                                                                                                                                                                                                 | Handling                                                                                                       |
| -------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Layout merge / second review                       | Merged and revalidated                        | The reviewed layout work landed as de77130f (#1048). Fresh base is e7162008; all 116 v1 files have identical Git tree content to 01d889a0.                                                                                                                                                | Retain candidate IDs and filenames; update shared changes, evidence strength and current catalog measurements. |
| Java search canonical paths                        | Resolved since first review                   | cee398cc (#1071) changed the Java search source and its source/orchestration tests to the canonical name?version= form.                                                                                                                                                                   | Keep this fix; old paths in a few v1 interaction fixtures are fixture debt, not a live source regression.      |
| Foundation / routing                               | Resolved + intentional                        | Theme modes, no-flash paint, shared primitives, separate v1 app and canonical routes shipped. Both route tables currently contain the same 16 path strings. Manual selected-mode versus OS-driven utility styling was not covered by the original completion claim; C09 now addresses it. | Keep the routing pivot and shared primitives until planned cutover.                                            |
| Home search fan-out                                | Resolved; documentation stale                 | Current search adapters load slim index.json files; the older ~250-request concern and later bundle-only description no longer describe search.                                                                                                                                           | Do not propose another index or concurrency cap. Update the comments/ledger.                                   |
| Landing live data / translation                    | Shipped; composition bugs remain              | Live counts/version/deltas and landing i18n exist; null fallback semantics remain defective (C05).                                                                                                                                                                                        | Close the old “wire live data” checklist; preserve the approved static error snapshot.                         |
| Landing screenshots                                | Resolved                                      | Bare /collector and /java-agent routes are captured.                                                                                                                                                                                                                                      | Improve state coverage under C10 instead of adding duplicate route entries.                                    |
| Drawer focus follow-up                             | Resolved initially; lifecycle defects open    | Entry/trap/restore/modal/scrim/scroll lock shipped in Phase 4.                                                                                                                                                                                                                            | Track refocus and resize defects under C03.                                                                    |
| Recent layout branch                               | Resolved                                      | 16px root, hero CTA sizing, button weight/outline, Docsy offsets, globe/check language menu, 2×2 signal layout, type-scale tokens, translated StatusPill and home/landing metadata shipped.                                                                                               | Keep existing regression tests; follow remaining geometry, menu and metadata findings.                         |
| Stability styles / focus / semantic tests          | Partially open                                | Shared StatusPill is translated; detail/activity/facet representations and cross-feature CSS still diverge.                                                                                                                                                                               | C04/C08/C10 cover the remaining work; remove resolved wording from the ledger.                                 |
| Phase 5 merge state                                | Documentation stale                           | Local reachable commits 472a0fdd (#869) and 7e246098 (#870) contain both Phase 5 merges; NEXT-STEPS still calls them draft.                                                                                                                                                               | Reconcile current status without rewriting historical decision entries. No GitHub status claims were fetched.  |
| Normal README + current capabilities               | Source now available; reconciliation required | README renderer, telemetry and feature gates exist in shared/legacy code; v1 does not expose all of them.                                                                                                                                                                                 | C12 before cutover; do not treat all missing content as a still-blocked pipeline.                              |
| Activity pipeline / release dates                  | Still deferred                                | Activity feed remains authored; release dates and trustworthy weekly deltas need pipeline ownership.                                                                                                                                                                                      | Separate automation work; never edit generated registry history manually.                                      |
| Schema pipeline / README diff / timeline summaries | Still deferred                                | No live per-version configuration-schema adapter; README diff and per-version summaries remain planned.                                                                                                                                                                                   | Retain designed unsupported states; use real data to define future comparison meaning.                         |
| Search overflow                                    | Still deferred                                | Dropdown caps results at ten; no browse-all destination.                                                                                                                                                                                                                                  | Product enhancement; do not hide inside architecture cleanup.                                                  |
| Locked semantics                                   | Intentional                                   | Four-literal Signal facet, list/Collector translation namespace split, Java substring categories, client-side search and static error fallback are recorded decisions.                                                                                                                    | Preserve them unless the selected candidate explicitly reopens one.                                            |
| Legacy removal / flattening                        | Deferred / out of scope                       | Go-live cleanup owns flag, legacy app/chrome and replaced content deletion; v1 directory flattening is expressly out of scope.                                                                                                                                                            | Do not consolidate duplicate route tables during the temporary migration.                                      |

### Verification baseline

| Check            | Result                                                  | Evidence / limits                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused tests    | 273 passed / 42 files on current locked dependencies    | After bun install --frozen-lockfile: NODE_OPTIONS=--no-experimental-webstorage bun run test src/v1 src/components/layout/scroll-to-top.test.tsx src/components/ui/status-pill.test.tsx src/lib/seo/locale-copy.test.ts src/lib/search. Vitest 4.1.11.                                                                                                        |
| Runtime setup    | Dependencies synchronized; original workaround retained | The first pass required disabling native Node Web Storage for jsdom storage. Fresh dependency installation changed no tracked lockfile; the rerun retained the same option.                                                                                                                                                                                  |
| Typecheck / lint | Typecheck passed; lint passed with 3 warnings           | No lint errors. Warnings are the pre-existing unused react-refresh suppressions on current main.                                                                                                                                                                                                                                                             |
| Locale keys      | en/es structures match                                  | All English namespace leaf-key sets compared to Spanish; this is key parity, not copy coverage.                                                                                                                                                                                                                                                              |
| Route paths      | 16 / 16 path strings match                              | Static parity check of LegacyApp and V1App; behavior differs at historical list entry.                                                                                                                                                                                                                                                                       |
| Local browser    | New interaction reproductions after merge               | Current Chromium: all four OS/selected-theme pairs; pending search restored after Clear all in 176ms; drawer filter updates refocus Close; desktop resize retains modal scroll lock; injected snapshot 503 renders registry absence. First-pass historical navigation, metadata and mobile geometry evidence remains recorded against the unchanged v1 tree. |
| React Doctor     | 63/100 across whole frontend; unchanged                 | Fresh scan: 438 files, 122 diagnostics (2 errors, 120 warnings), with 16 warnings under src/v1. This is not a v1-specific score.                                                                                                                                                                                                                             |
| Not run          | Outside this review baseline                            | Full application test suite, separate integration suite, production build and performance benchmark. No application edits were made.                                                                                                                                                                                                                         |

### React Doctor triage

| Disposition                        | Diagnostics                                                             | Interpretation                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Confirmed / useful                 | IME Enter and changing drawer close callback                            | C11 and C03; source review confirms concrete behavior.                                                                                                                         |
| Confirmed interaction case         | Three effects warnings at facets.tsx:134                                | One debounce synchronization pattern, not three defects. The second browser pass reproduced an uncommitted draft restoring q after Clear all (C02).                            |
| Context required                   | Large/high-complexity modules                                           | Use the responsibilities above; splitting by line count alone fails the depth test.                                                                                            |
| Low priority / not a proven defect | Small array membership checks; static breadcrumb index key; role=search | Small fixed facet vocabularies and stateless breadcrumbs do not establish a performance or correctness regression. No automatic Set conversion, provider or memoization sweep. |
| Outside redesign scope             | Remaining whole-frontend diagnostics                                    | Do not import unrelated legacy warnings into this plan. Retained legacy feature quality can be handled in its own work.                                                        |

### Review inventory

| File                                                                            | Reviewed by               |
| ------------------------------------------------------------------------------- | ------------------------- |
| ecosystem-explorer/src/v1/V1App.test.tsx                                        | Root integration review   |
| ecosystem-explorer/src/v1/V1App.tsx                                             | Root integration review   |
| ecosystem-explorer/src/v1/components/detail/detail-header.test.tsx              | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/detail-header.tsx                   | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/pipeline-placement.test.tsx         | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/pipeline-placement.tsx              | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/sibling-navigator.test.tsx          | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/sibling-navigator.tsx               | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/tabs.test.tsx                       | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/tabs.tsx                            | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/version-timeline.test.tsx           | List and detail review    |
| ecosystem-explorer/src/v1/components/detail/version-timeline.tsx                | List and detail review    |
| ecosystem-explorer/src/v1/components/ecosystem/pipeline-anatomy.test.tsx        | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/ecosystem/pipeline-anatomy.tsx             | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/ecosystem/quick-entry-row.test.tsx         | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/ecosystem/quick-entry-row.tsx              | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/ecosystem/release-card.test.tsx            | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/ecosystem/release-card.tsx                 | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/cover-block.test.tsx                  | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/cover-block.tsx                       | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/ecosystems-grid.test.tsx              | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/ecosystems-grid.tsx                   | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/global-search.test.tsx                | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/global-search.tsx                     | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/recent-activity-rail.test.tsx         | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/recent-activity-rail.tsx              | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/signals-row.test.tsx                  | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/signals-row.tsx                       | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/stats-band.test.tsx                   | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/home/stats-band.tsx                        | Home and ecosystem review |
| ecosystem-explorer/src/v1/components/icons/bluesky-icon.tsx                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/bs-icon-circle-half.tsx              | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/bs-icon-moon-stars-fill.tsx          | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/bs-icon-sun-fill.tsx                 | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/cncf-logo.tsx                        | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/fa-icon-check.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/fa-icon-globe.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/github-icon.tsx                      | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/mastodon-icon.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/opentelemetry-wordmark.tsx           | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/slack-icon.tsx                       | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/stack-overflow-icon.tsx              | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/icons/trademark-icon.tsx                   | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/cncf-callout.test.tsx               | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/cncf-callout.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/footer.test.tsx                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/footer.tsx                          | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/nav-bar.test.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/nav-bar.tsx                         | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/sub-nav.test.tsx                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/layout/sub-nav.tsx                         | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/list/controls.test.tsx                     | List and detail review    |
| ecosystem-explorer/src/v1/components/list/controls.tsx                          | List and detail review    |
| ecosystem-explorer/src/v1/components/list/facet-panel.test.tsx                  | List and detail review    |
| ecosystem-explorer/src/v1/components/list/facet-panel.tsx                       | List and detail review    |
| ecosystem-explorer/src/v1/components/list/facets.test.tsx                       | List and detail review    |
| ecosystem-explorer/src/v1/components/list/facets.tsx                            | List and detail review    |
| ecosystem-explorer/src/v1/components/list/views.test.tsx                        | List and detail review    |
| ecosystem-explorer/src/v1/components/list/views.tsx                             | List and detail review    |
| ecosystem-explorer/src/v1/components/ui/language-toggle.test.tsx                | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/ui/language-toggle.tsx                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/ui/theme-toggle.test.tsx                   | Chrome and styles review  |
| ecosystem-explorer/src/v1/components/ui/theme-toggle.tsx                        | Chrome and styles review  |
| ecosystem-explorer/src/v1/features/_dev/components-page.tsx                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/features/detail/detail-page.test.tsx                  | List and detail review    |
| ecosystem-explorer/src/v1/features/detail/detail-page.tsx                       | List and detail review    |
| ecosystem-explorer/src/v1/features/detail/diff-page.test.tsx                    | List and detail review    |
| ecosystem-explorer/src/v1/features/detail/diff-page.tsx                         | List and detail review    |
| ecosystem-explorer/src/v1/features/ecosystem/collector-config.tsx               | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/collector-landing.tsx              | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.test.tsx            | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/ecosystem-page.tsx                 | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/java-agent-config.tsx              | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/java-agent-landing.tsx             | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/types.ts                           | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.test.ts | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/ecosystem/use-ecosystem-landing-data.ts      | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/home/home-page.test.tsx                      | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/home/home-page.tsx                           | Home and ecosystem review |
| ecosystem-explorer/src/v1/features/list/list-page.test.tsx                      | List and detail review    |
| ecosystem-explorer/src/v1/features/list/list-page.tsx                           | List and detail review    |
| ecosystem-explorer/src/v1/hooks/use-activity-feed.test.ts                       | Home and ecosystem review |
| ecosystem-explorer/src/v1/hooks/use-activity-feed.ts                            | Home and ecosystem review |
| ecosystem-explorer/src/v1/hooks/use-search.ts                                   | Home and ecosystem review |
| ecosystem-explorer/src/v1/index.ts                                              | Root integration review   |
| ecosystem-explorer/src/v1/lib/home-stats.ts                                     | Home and ecosystem review |
| ecosystem-explorer/src/v1/lib/list-filters.test.ts                              | List and detail review    |
| ecosystem-explorer/src/v1/lib/list-filters.ts                                   | List and detail review    |
| ecosystem-explorer/src/v1/lib/schema-diff.test.ts                               | List and detail review    |
| ecosystem-explorer/src/v1/lib/schema-diff.ts                                    | List and detail review    |
| ecosystem-explorer/src/v1/styles/buttons.css                                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/cncf-callout.css                               | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/cover-block.css                                | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/detail.css                                     | List and detail review    |
| ecosystem-explorer/src/v1/styles/ecosystems-grid.css                            | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/facet-panel.css                                | List and detail review    |
| ecosystem-explorer/src/v1/styles/facets.css                                     | List and detail review    |
| ecosystem-explorer/src/v1/styles/footer.css                                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/global-search.css                              | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/home.css                                       | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/index.css                                      | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/language-toggle.css                            | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/list-controls.css                              | List and detail review    |
| ecosystem-explorer/src/v1/styles/list-page.css                                  | List and detail review    |
| ecosystem-explorer/src/v1/styles/list-views.css                                 | List and detail review    |
| ecosystem-explorer/src/v1/styles/navbar.css                                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/pipeline-anatomy.css                           | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/quick-entry-row.css                            | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/recent-activity-rail.css                       | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/release-card.css                               | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/signals-row.css                                | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/stats-band.css                                 | Home and ecosystem review |
| ecosystem-explorer/src/v1/styles/sub-nav.css                                    | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/theme-toggle.css                               | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/tokens.css                                     | Chrome and styles review  |
| ecosystem-explorer/src/v1/styles/type-scale.test.ts                             | Chrome and styles review  |

### Selection checkpoint

Which of these would you like to explore? Once selected, work through constraints and the module
shape before implementation. This branch publishes the plan and report; implementation follows
candidate selection.
