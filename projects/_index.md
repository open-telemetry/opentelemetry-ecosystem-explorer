# `projects/` — Initiative workspace

Top-level index for planning workspaces. Each significant initiative gets its own subfolder here.
This file is the meta-index — for the _current state of work_ on a specific initiative, open that
initiative's own `_index.md`.

> [!NOTE] Note on frontmatter
>
> This file is intentionally outside the scope of
> [`frontmatter.schema.json`](./frontmatter.schema.json), which validates docs under
> `projects/<issue-number>-<slug>/`. Top-level meta files (this one) don't carry issue / phase /
> status fields because they aren't tied to any single initiative.

---

## What lives here

```text
projects/
├── _index.md                  ← this file
├── frontmatter.schema.json    ← validates per-initiative doc frontmatter
└── <issue-number>-<slug>/     ← one folder per initiative (see "Current initiatives" below)
```

---

## Current initiatives

| Folder                                           | Issue                                                                                 | Description                                                                                                                 | Status      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [`84-ui-ux-design/`](./84-ui-ux-design/)         | [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84)   | Explorer UI/UX redesign — visual alignment with opentelemetry.io, phased across five page areas.                            | planning    |
| [`154-genai-ecosystem/`](./154-genai-ecosystem/) | [#154](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/154) | Research GenAI ecosystem — survey of GenAI/LLM instrumentation libraries and semantic convention coverage across languages. | in-progress |

---

## Folder convention

Each significant initiative gets its own subfolder, named after the GitHub issue that tracks it:

```text
projects/<issue-number>-<slug>/
```

Examples (real and hypothetical):

- `projects/84-ui-ux-design/` — issue
  [#84](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/84), the explorer
  redesign.
- `projects/123-search-backend/` — would track a hypothetical search backend initiative.

The slug is short, kebab-case, and describes the initiative in 2–4 words.

---

## Frontmatter convention

Every markdown file inside an initiative folder ships with YAML frontmatter validated by
[`frontmatter.schema.json`](./frontmatter.schema.json):

```yaml
---
title: "Phase 1 — Foundation" # human-readable; mirrors the H1
issue: 84 # GitHub issue number; matches parent folder
type: plan # plan | audit | brief | roadmap | index
phase: 1 # 1-N or "meta" for cross-phase docs
status: planning # planning | in-progress | complete | archived
last_updated: "2026-05-06" # ISO date as quoted string (bare YAML dates fail validation)
---
```

`type` distinguishes:

- **`plan`** — forward-looking work plan for a phase.
- **`audit`** — current-state analysis or codebase delta.
- **`brief`** — design rationale or direction document.
- **`roadmap`** — rolling state-of-work index, updated continuously. One per folder, conventionally
  `NEXT-STEPS.md`.
- **`index`** — stable folder landing page describing what lives in the folder and where to start.
  One per folder, conventionally `_index.md`.

When updating substantive content, bump `last_updated`. When work moves forward, update `status`
(`planning` → `in-progress` when the first PR opens; `in-progress` → `complete` when the cleanup PR
merges).

---

## Cross-link rules

- **Within an initiative folder**, cross-link with relative paths: `./NEXT-STEPS.md`,
  `./00-foundation.md`.
- **From an initiative to repo files**, use `../../`: e.g., `../../ecosystem-explorer/DESIGN.md`.
- **Across initiatives**, prefer linking to the other initiative's `_index.md` rather than to
  individual files inside it; the index is the stable contract, individual files may be renamed or
  split.

---

## Don't-delete rule

Don't delete files inside an initiative folder without an explicit reason. Even superseded plans are
useful as historical context — readers can see what was tried and why it was changed. Mark docs as
`status: archived` instead of removing them.

---

## Starting a new initiative

When kicking off a significant cross-phase effort:

1. Open (or pick) a GitHub issue that tracks the initiative.
2. Create `projects/<issue-number>-<slug>/`.
3. Drop in `_index.md` (folder landing page) and `NEXT-STEPS.md` (rolling roadmap) using the
   structure of [`84-ui-ux-design/`](./84-ui-ux-design/) as a template.
4. Add per-phase plan docs (`00-…`, `01-…`, etc.) as the work crystallizes.
5. Add a row to the **Current initiatives** table above so this index stays accurate.
6. Every doc inside the new folder must satisfy
   [`frontmatter.schema.json`](./frontmatter.schema.json).
