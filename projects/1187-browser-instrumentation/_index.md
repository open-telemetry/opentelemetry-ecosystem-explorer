---
title: "Research - Browser Instrumentation Metadata"
issue: 1187
type: index
phase: 1
status: in-progress
last_updated: "2026-10-01"
---

Research into how the explorer could cover the instrumentations in `opentelemetry-browser`, and
whether that work belongs with the JavaScript watcher and the JavaScript pages.

## What lives here

- `_index.md` - this file
- `NEXT-STEPS.md` - proposed steps and open questions
- `01-metadata-audit.md` - what the browser repo exposes today, and a first-draft registry entry
- `02-watcher-and-presentation.md` - start here, the four questions in the issue answered

## Summary

The proposal is to read the browser repo from the existing `js-instrumentation-watcher` as a second
source, write one registry entry per npm package and version under
`ecosystem-registry/javascript/browser-instrumentation/`, and list the nine modules inside it.
Telemetry waits for the browser events to get a convention registry upstream (two of seven are in
semantic conventions today) or for data from a test run. On the site it would sit with JavaScript
behind a browser filter, not as its own ecosystem. The open questions in `NEXT-STEPS.md` are where
this could change.

## Related

- Issue: [#1187](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1187)
- Upstream repo: [opentelemetry-browser](https://github.com/open-telemetry/opentelemetry-browser)
- Earlier JavaScript research:
  [`9-javascript-instrumentation/`](../9-javascript-instrumentation/_index.md)
