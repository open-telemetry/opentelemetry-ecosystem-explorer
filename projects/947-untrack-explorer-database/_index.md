---
title: "Issue #947 — Untrack the explorer database"
issue: 947
type: index
phase: meta
status: in-progress
last_updated: "2026-09-23"
---

> [!NOTE]
>
> This is the folder landing page. For the current state of work, open
> [`NEXT-STEPS.md`](./NEXT-STEPS.md).

## Issue #947 — Untrack the explorer database

Stop committing the generated database in
`ecosystem-explorer/public/data/{javaagent,collector,configuration}/`. Publish it instead as
per-ecosystem `.tar.gz` GitHub Release assets, pinned by a committed `data-manifest.json`. Merging a
manifest bump stays the promotion event that moves the live site.

Tracking issue:
[#947](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/947)

## Why

The generated database is 2,046 files and 19.6 MB of JSON and Markdown. Filenames are
content-addressed, so a content change is a new path plus a deletion, never a modification, which is
what makes the rebuild diffs large: across 23 merged automated updates the median is 117 changed
files and the largest is 1,003.

The issue gives four reasons. Three of them carry this change on their own:

- **Review cost.** At the top of that range the diff is not a practical place to notice one
  unintended change. Evidence, and what replaces the diff as a control, in
  [`design-decisions.md` §6](./design-decisions.md#6-reviewability).
- **Deploy pinning.** Nothing today records which database a given deploy was built from, so
  previews and rollbacks are not reproducible. A committed manifest gives that for free.
- **Checkout weight.** 2,046 files, up 21% from 1,688 in the seven weeks to 2026-09-23.

The fourth, repository size, is smaller than the raw figure suggests. The issue records 28.5 MB of
`public/data` blob bytes reachable from `HEAD`; the same measure at `979b9046` is 45.4 MB, so the
method reproduces and the value has grown with the data. It is uncompressed size, and git stores
these blobs packed:

```bash
git rev-list --objects HEAD -- ecosystem-explorer/public/data | awk '{print $1}' \
  | git cat-file --batch-check='%(objecttype) %(objectsize) %(objectsize:disk)' \
  | awk '$1=="blob"{u+=$2;d+=$3} END{printf "uncompressed %.1f MB, on disk %.1f MB\n", u/1e6, d/1e6}'
```

On disk that is 4.8 MB. Of the repository's 1.77 GiB of packed objects, 99% is reachable only from
the screenshot branches. Growth is not superlinear either: content-addressed blobs are stored once
and never re-stored, and the history-to-tree ratio has fallen from 2.7x to 2.3x.

## What lives here

| Phase | File                                           | Purpose                                                              | Status      |
| ----- | ---------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| meta  | [`_index.md`](./_index.md)                     | This file. Stable folder landing page.                               | —           |
| meta  | [`NEXT-STEPS.md`](./NEXT-STEPS.md)             | Rolling roadmap: sequence, gates, known defects, decision log.       | —           |
| meta  | [`design-decisions.md`](./design-decisions.md) | The six design decisions, alternatives considered, and the evidence. | —           |
| 1     | [`01-test-suite.md`](./01-test-suite.md)       | Make the test suite independent of the generated database.           | in-progress |

`status` reflects the work the document describes, not the document itself. Documents for pull
requests 2 to 4 are added as each is planned.

## Prior work

Phase 0 shipped as
[#1155](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1155) and is a hard
prerequisite; [`NEXT-STEPS.md`](./NEXT-STEPS.md) explains why.

## Workspace conventions

Folder layout, frontmatter and cross-link rules for `projects/` are documented in
[`projects/_index.md`](../_index.md).
