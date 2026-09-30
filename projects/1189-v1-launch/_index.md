---
title: "V1 launch"
issue: 1189
type: index
phase: meta
status: planning
last_updated: "2026-09-29"
---

# V1 launch

Landing page for the work that takes the #84 redesign from "all phases merged" to "live in
production": the V1 readiness review, the redesign audit, the bug bash, and the end-of-redesign
cleanup (PR 8) that flips production to V1.

For the current state of work, open [`NEXT-STEPS.md`](./NEXT-STEPS.md).

## Where things live

| What                                     | Where                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Readiness review (umbrella)              | [#1189](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1189), with area and cross-cutting sub-issues              |
| Redesign audit                           | Issue in the `V1 Launch` milestone, labeled `v1:audit`                                                                                       |
| Milestone                                | `V1 Launch`                                                                                                                                  |
| Board                                    | [`Explorer V1 Launch`](https://github.com/orgs/open-telemetry/projects/209) (GitHub Project in the `open-telemetry` org)                     |
| Review runbook (skill)                   | [`.ai/skills/v1-page-review/`](../../.ai/skills/v1-page-review/)                                                                             |
| V1 design system                         | [`ecosystem-explorer/DESIGN_V1.md`](../../ecosystem-explorer/DESIGN_V1.md), renamed to `DESIGN.md` by PR 8                                   |
| Redesign plans and history               | [`84-ui-ux-design/`](../84-ui-ux-design/_index.md)                                                                                           |
| UX research and information architecture | [`ux-research-and-info-arc/`](../ux-research-and-info-arc/)                                                                                  |
| Staging (V1)                             | <https://v1--otel-ecosystem-explorer.netlify.app/>, synced from `main` by `sync-main-to-v1.yml` ([`docs/v1-sync.md`](../../docs/v1-sync.md)) |

## Labels

| Label          | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| `v1:readiness` | Readiness review work: the umbrella and its sub-issues |
| `v1:audit`     | Redesign audit work and the gaps it finds              |
| `v1:finding`   | One problem found by a review                          |
| `v1:blocker`   | Blocks the go-live (PR 8)                              |

The blocker criteria live in the runbook's [`SKILL.md`](../../.ai/skills/v1-page-review/SKILL.md).
