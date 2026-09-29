---
name: v1-page-review
description: Review a page of the V1 explorer redesign before go-live, in one of two modes. Readiness mode is the QA pass (legacy parity, visuals in both themes and three widths, design, React Doctor, accessibility, i18n, performance, tests). Audit mode checks the page against the UX research's ecosystem guiding principles and five-node baseline. Use when asked to review a V1 route, area, or cross-cutting dimension for V1 readiness, to audit the redesign's information architecture, or to draft `v1:finding` issues.
---

# V1 page review

The V1 redesign (issue #84) renders under the `V1_REDESIGN` flag and ships to production when the
end-of-redesign cleanup (PR 8) lands. This skill runs the reviews that gate that go-live and turns
what they find into **findings**: one problem each, ready to become a `v1:finding` issue.

- **Readiness mode**: the QA pass. The procedure for each check is in [`readiness.md`](readiness.md).
- **Audit mode**: conformance with the UX research and information architecture in
  [`projects/ux-research-and-info-arc/`](../../../projects/ux-research-and-info-arc/). The
  procedure is in [`audit.md`](audit.md).

Both modes write the same report, using [`checklist.md`](checklist.md).

## Environments

- **Staging** (V1, synced from `main` by `sync-main-to-v1.yml`):
  <https://v1--otel-ecosystem-explorer.netlify.app/>
- **Production** (legacy, the parity reference): <https://explorer.opentelemetry.io/>
- **Local V1**, when staging is behind `main`: see "Tools" in [`readiness.md`](readiness.md).

## Pages

`ecosystem-explorer/src/v1/V1App.tsx` is the route table. Classify every route in scope from where
its page component is imported (most are lazy imports; the Java Agent instrumentation detail route
uses the static `InstrumentationHandler` import):

- **Tier 1**: imports from `@/v1/features/`. The page was redesigned and gets every check in its
  mode.
- **Tier 2**: imports from `@/features/`. A legacy page rendering inside the V1 layout. Before
  reviewing it, look up its decision in the page table of the readiness umbrella issue,
  [#1189](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1189):
  - `port`: it gets rebuilt under `src/v1/`. Review the port's PR, not the legacy page.
  - `light review` or `keep`: run the tier 2 subset in [`readiness.md`](readiness.md).
  - No decision yet: stop and report that the page is waiting on a decision.

`/_dev/components` is out of scope: it is dev-only and sits behind `DEV_SHOWCASE`.

Each route belongs to one **area**, which maps it to a review sub-issue:

| Area                  | Routes                                                              |
| --------------------- | ------------------------------------------------------------------- |
| Layout + Home         | `/` and the shared layout (navbar, footer, CNCF callout, search)    |
| Collector             | `/collector` and everything under it                                |
| Java Agent            | `/java-agent` and everything under it                               |
| Semconv / About / 404 | `/semantic-conventions/*`, `/about`, the catch-all 404               |

## Steps

1. **Scope.** List the routes to review (one route, one area, or every route for a cross-cutting
   dimension), with each route's tier. The step is done when every route in scope has a tier and,
   for tier 2, a decision.
2. **Staging freshness.** Run
   `gh api repos/open-telemetry/opentelemetry-ecosystem-explorer/compare/v1...main -q .ahead_by`.
   A result of `0` means staging's branch contains `main`. Any other number means staging is
   behind: report it and review locally instead.
3. **Review.** Run every check your mode assigns to each route. Done means every row of the
   checklist has a result (`pass`, `fail`, or `n/a` with a reason) and every `fail` has evidence:
   a screenshot path, an axe rule id, a console error, or the URL plus the steps that reproduce it.
4. **Classify.** For each `fail`, decide whether it is a **blocker** (see below). Group failures
   that share a root cause into one finding.
5. **Report.** Fill the report template in [`checklist.md`](checklist.md): one checklist per page
   and one finding draft per finding. Hand the report to a human, who reviews the drafts and opens
   the issues. Agents deliver drafts only: the human decides what becomes an issue.

## Blocker criteria

A finding is a **blocker** (label `v1:blocker`, blocks PR 8) when it is one of:

- **Functional regression**: production's legacy page does something the V1 page does not (a
  filter, a link, a data field, a deep link or URL shape), or a route errors, 404s, or redirects
  wrongly.
- **WCAG 2.1 AA violation**: an axe violation, a keyboard trap or unreachable control, a missing
  focus indicator, or a contrast failure, in either theme.
- **Missing i18n**: user-visible text that bypasses i18next, or a key missing from `en` or `es`.
- **Broken visual**: broken layout, clipped or overlapping content, or horizontal scroll, in light
  or dark, at desktop, tablet, or mobile width.

Every other finding is non-blocking: design nits, duplicated components, performance observations,
test gaps. Audit gaps follow their own triage (see [`audit.md`](audit.md)) and become blockers only
when the triage says so.
