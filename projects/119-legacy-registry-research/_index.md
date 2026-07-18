---
title: "Issue #119 — Legacy Registry Research"
issue: 119
type: index
phase: meta
status: in-progress
last_updated: "2026-05-11"
---

## Issue #119 — Legacy Registry Research

> Folder landing page. For the current state of findings and proposals jump to
> [`NEXT-STEPS.md`](./NEXT-STEPS.md). For the full research document jump to
> [`00-research.md`](./00-research.md).

---

## What this folder is

A research workspace for
[issue #119](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/119), which
tasks us with identifying the overlaps and gaps between the V1 registry
(opentelemetry.io/data/registry) and the V2 registry (ecosystem-explorer), starting with collector
components, and producing concrete proposals on how the two registries should relate going forward.

---

## Where to start

1. **[`_index.md`](./_index.md)** (you are here) — folder landing page.
2. **[`00-research.md`](./00-research.md)** — full findings: component coverage, metadata
   comparison, automation overview, and gap analysis.
3. **[`NEXT-STEPS.md`](./NEXT-STEPS.md)** — proposals and recommended next steps based on the
   research.

---

## Files in this folder

| File                                 | Purpose                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| [`_index.md`](./_index.md)           | This file. Stable folder landing page.                                                     |
| [`00-research.md`](./00-research.md) | Full research findings. Component counts, metadata fields, automation analysis, gap table. |
| [`NEXT-STEPS.md`](./NEXT-STEPS.md)   | Rolling roadmap. Proposals and recommended actions.                                        |

---

## Scope

The research covers:

- Collector component coverage in V1 vs V2 (counts and overlap)
- Metadata fields tracked in each registry
- How V1 is currently maintained and used
- How the collector-sync automation in opentelemetry.io works
- Whether V2 can automate V1 maintenance and what that would require
