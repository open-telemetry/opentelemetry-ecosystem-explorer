---
title: "Roadmap — V1 launch"
issue: 1189
type: roadmap
phase: meta
status: planning
last_updated: "2026-09-29"
---

# Roadmap — V1 launch

Rolling roadmap for the V1 launch, tracked under
[#1189](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1189). Update it
as decisions land and issues close. The folder landing page is [`_index.md`](./_index.md).

## Where we are

- **2026-09-29 snapshot:** all five redesign phases of #84 are merged (Phase 5 closed with #869 and
  #870). The "Explorer EOY 2026 Priorities" sync (2026-09-21) asked for a V1 readiness review issue,
  a runbook, a milestone, labels, a board, and a redesign audit issue. This folder, the
  `v1-page-review` skill, and the issue drafts come out of that. Staging's `v1` branch contains
  `main`.

## Immediate next steps

In order:

- [ ] Create the `V1 Launch` milestone, the `v1:*` labels, the umbrella (#1189), and the smoke-test
      issue. Move #84 to `V1 Launch` and close `MVP Launch`.
- [x] Create the `Explorer V1 Launch` board
      ([#209](https://github.com/orgs/open-telemetry/projects/209)).
- [ ] Merge the `v1-page-review` skill.
- [ ] Dry-run the skill: readiness mode on `/collector/components`, audit mode on the Collector
      component page.
- [ ] Open the eight review sub-issues and the redesign audit issue.
- [ ] Record a decision (port, light review, or keep) for every tier 2 page in #1189.
- [ ] Run the area and cross-cutting reviews and the audit, in parallel.
- [ ] Triage the audit gaps; fix every `v1:blocker`.
- [ ] Bug bash on staging with the local SIGs.
- [ ] End-of-redesign cleanup (PR 8): go-live.

## Decisions blocking progress

None open. The five questions from planning were answered on 2026-09-29; see the decision log.

## Decision log

| Date       | Decision                                                                                                                                                                             | Notes                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | The readiness review and the redesign audit are two issues in one milestone.                                                                                                         | Readiness is the QA pass; the audit checks the research's guiding principles and five-node baseline.                          |
| 2026-09-29 | Readiness work splits into four area sub-issues (Layout + Home, Collector, Java Agent, Semconv / About / 404) and four cross-cutting ones (accessibility, i18n, performance, tests). | Cross-cutting dimensions need specialists; area reviews own parity, visuals, design, React Doctor, duplication.               |
| 2026-09-29 | Each tier 2 page (legacy component inside the V1 layout) gets an explicit decision: port, light review, or keep.                                                                     | Recorded in the umbrella's page table; a port blocks PR 8.                                                                    |
| 2026-09-29 | Blockers are functional regressions, WCAG 2.1 AA violations, missing i18n, and broken visuals in either theme or any width.                                                          | Everything else is a non-blocking `v1:finding`.                                                                               |
| 2026-09-29 | Each problem becomes its own `v1:finding` issue, a sub-issue of the review that found it; `v1:blocker` marks go-live blockers.                                                       | Label family `v1:readiness`, `v1:audit`, `v1:finding`, `v1:blocker`.                                                          |
| 2026-09-29 | New `V1 Launch` milestone; #84 moves to it and `MVP Launch` closes. New `Explorer V1 Launch` board.                                                                                  | Board [#209](https://github.com/orgs/open-telemetry/projects/209): Status and Area fields; views filter on the `v1:*` labels. |
| 2026-09-29 | One `v1-page-review` skill with a readiness mode and an audit mode, in `.ai/skills/`.                                                                                                | Agents deliver a report plus finding drafts; a human reviews the drafts before opening issues.                                |
| 2026-09-29 | The readiness review absorbs #84's post-Phase 5 reconciliation pass; order is reviews, fixes, bug bash, PR 8.                                                                        | The bug bash is a task in the umbrella, not its own issue.                                                                    |
| 2026-09-29 | Audit gaps are triaged case by case with Jay: V1 (blocker) or post-V1.                                                                                                               | Gaps waiting on registry data are pipeline gaps.                                                                              |
| 2026-09-29 | Smoke tests and monitoring get their own non-blocking issue, outside the critical path.                                                                                              | Component duplication is recorded as non-blocking findings.                                                                   |
| 2026-09-29 | Reviews run against staging; local runs with `VITE_FEATURE_FLAG_V1_REDESIGN=true` only when staging is behind `main`.                                                                | Screenshots and axe run against staging via `ACCEPTANCE_BASE_URL`.                                                            |
| 2026-09-29 | `ecosystem-explorer/DESIGN_V1.md` is the single V1 design reference; reviews keep it in sync with the as-built V1, and PR 8 renames it to `DESIGN.md`.                               | A stale or silent doc section becomes a non-blocking finding. The design brief is historical rationale.                       |
| 2026-09-29 | Vitor creates the `Explorer V1 Launch` board in the `open-telemetry` org.                                                                                                            | He has the permission.                                                                                                        |
| 2026-09-29 | The readiness umbrella and the redesign audit are sub-issues of #84, like the five phase issues; #84 closes when PR 8 merges.                                                        | Post-V1 audit gaps stay open as independent issues, outside #84 and the `V1 Launch` milestone.                                |
| 2026-09-29 | Audit gaps are triaged asynchronously, in comments on the audit issue.                                                                                                               |                                                                                                                               |
| 2026-09-29 | Vitor renews `V1_SYNC_TOKEN` when it expires.                                                                                                                                        | The skill checks `compare/v1...main` before every review.                                                                     |
| 2026-09-30 | The Portuguese translations issue is not opened with the V1 launch issues; its draft stays local.                                                                                    |                                                                                                                               |
