---
title: "Issue #84 — Explorer UI/UX Design"
issue: 84
type: index
phase: meta
status: planning
last_updated: "2026-05-06"
---

> [!NOTE]
>
> This file was drafted in collaboration with Claude Opus 4.7. Corrections are welcome.

## Issue #84 — Explorer UI/UX Design

> Folder landing page. This is the _what's here, where to start_ index for the
> [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84) UI/UX redesign
> initiative. For the _current state of work_ and decision log, jump to
> [`NEXT-STEPS.md`](./NEXT-STEPS.md).

---

## What this folder is

A planning workspace for the visual redesign of the OpenTelemetry Ecosystem Explorer. The work is
staged in five phases (foundation + four pages), all gated behind a `V1_REDESIGN` feature flag, and
all aligned to the visual language of [opentelemetry.io](https://opentelemetry.io).

This folder follows the per-issue convention: each significant initiative gets its own subfolder
under `projects/`, named `<issue-number>-<slug>/`. Future initiatives slot in alongside (e.g.,
`projects/123-search-backend/`).

---

## Where to start

If you've never opened this folder before, read in this order:

1. **[`_index.md`](./_index.md)** _(you are here)_ — folder landing page.
2. **[`NEXT-STEPS.md`](./NEXT-STEPS.md)** — rolling roadmap. State of work, decision log, immediate
   next steps. **This is the most important file in the folder.**
3. **[`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md)** — design
   rationale. Why we're aligning to opentelemetry.io, what the direction is, what the trade-offs
   are.
4. **[`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html)** — open in a
   browser. Four interactive page mockups (Home / Ecosystem landing / List / Detail), light + dark
   theme toggle. Visual reference for everything below.
5. **[`00-foundation-audit.md`](./00-foundation-audit.md)** — codebase audit. Read before suggesting
   any code changes — describes what already exists in `ecosystem-explorer/src/` and the concrete
   delta per foundation task.

After that, dive into whichever phase is relevant to your work.

---

## Files in this folder

### Index and roadmap

| File                               | Purpose                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`_index.md`](./_index.md)         | This file. Stable folder landing page.                                                                                                                  |
| [`NEXT-STEPS.md`](./NEXT-STEPS.md) | Rolling roadmap — state of work, immediate next steps, decision log. Updated continuously as PRs ship and decisions land. **Primary working document.** |

### Design rationale and visual reference

| File                                                                               | Purpose                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`ecosystem-explorer-v1-design-brief.md`](./ecosystem-explorer-v1-design-brief.md) | Direction document. Why alignment first, what changes from v0, page-by-page spec, suggested sub-issues.      |
| [`ecosystem-explorer-v1-mockups.html`](./ecosystem-explorer-v1-mockups.html)       | Static HTML prototype. Four pages, light + dark themes. Open in a browser to see the target visual language. |

### Phase plans

Each phase has its own plan with goal, scope (in/out), dependencies, tasks, acceptance criteria, and
open questions.

| Phase | File                                                   | Status   |
| ----- | ------------------------------------------------------ | -------- |
| 1     | [`00-foundation.md`](./00-foundation.md)               | planning |
| 1     | [`00-foundation-audit.md`](./00-foundation-audit.md)   | planning |
| 2     | [`01-home-page.md`](./01-home-page.md)                 | planning |
| 3     | [`02-ecosystem-landing.md`](./02-ecosystem-landing.md) | planning |
| 4     | [`03-list-page.md`](./03-list-page.md)                 | planning |
| 5     | [`04-detail-page.md`](./04-detail-page.md)             | planning |

`status` reflects the work the document describes (not the document itself). When the first PR for a
phase opens, bump status to `in-progress`. When the cleanup PR for that phase merges, bump to
`complete`.

---

## Phase summary

```text
Phase 1 — Foundation       (00-foundation.md, 00-foundation-audit.md)
   └─ Theme system, NavBar, Footer, CncfCallout, StatusPill, TypeStripe, Card primitive.
      Land first; everything else depends on it. 9 PRs gated behind V1_REDESIGN.

Phase 2 — Home page         (01-home-page.md)
   └─ Cover-block hero, ⌘K search, OTel-purple stats band, ecosystems grid,
      browse-by-signal, recent activity rail.

Phase 3 — Ecosystem landing (02-ecosystem-landing.md)
   └─ Per-ecosystem hero with release card, pipeline anatomy diagram (reusable),
      quick-entry strip. Couples with Phase 4 via the URL contract.

Phase 4 — List page         (03-list-page.md)
   └─ Faceted left rail, density toggle (Cards / Compact / Table), active-filter
      chips, URL-persisted state. Biggest UX win.

Phase 5 — Component detail  (04-detail-page.md)
   └─ Three-pane shell, sibling navigator, embedded docs, version timeline + diff.
      Split into PR 04a (shell + docs) and PR 04b (timeline + diff).
```

---

## Workspace conventions

For the folder convention, frontmatter schema, type taxonomy, cross-link rules, and how to start a
new initiative, see [`projects/_index.md`](../_index.md). Those rules are the same across every
initiative — this folder follows them.
