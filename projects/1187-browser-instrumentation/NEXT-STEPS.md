---
title: "Roadmap - Browser Instrumentation Research"
issue: 1187
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-11-02"
---

## Done

- [x] Audited `opentelemetry-browser` at `0aac882` (`01-metadata-audit.md`)
- [x] Dry run of the JavaScript builder with a browser entry added to a copy of the registry
- [x] Compared three watcher shapes and the presentation options (`02-watcher-and-presentation.md`)

## Proposed steps, each small enough to merge alone

1. [x] A browser source in `js-instrumentation-watcher` that writes the package entry with `modules`
       (`name`, `import_path`, `source_path`), read at release tags. The JavaScript builder
       publishes `modules` and `repository` on the package file.
2. [x] `scope_name` per module, optional and left out when the pattern does not match.
3. [x] An optional `platform: browser` field from the `web` keyword, in both watcher sources and the
       package files
       ([#1368](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1368)).
       Existing registry releases stay unchanged.
4. Module names in `index.json` so search on the list page from
   [#990](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/990), still in
   progress, finds a module. The builder and data layer are merged
   ([#1202](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1202),
   [#1223](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1223),
   [#1309](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1309)), so this
   can build on the existing index and TypeScript types.
5. Telemetry, once the trigger in `02-watcher-and-presentation.md` fires.

## Telemetry from a run

The explorer already has work in flight to import the published reports of
[semantic-conventions-conformance](https://github.com/open-telemetry/semantic-conventions-conformance)
([#1183](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1183), open PR
[#1188](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1188)). A trial ran
three modules of the 0.8.1 package (errors, console, web-vitals), each alone on a page in headless
Chrome, through that repo's runner at `1860208` against semantic conventions v1.44.0. The scenarios
are proposed in
[semantic-conventions-conformance#258](https://github.com/open-telemetry/semantic-conventions-conformance/pull/258),
not merged yet. `browser.web_vital` conformed, all six attributes found. `browser.console` was
reported as `missing_event` and `missing_attribute`, since v1.44.0 does not define it. `exception`
was reported missing `exception.escaped`, which v1.44.0 marks deprecated, so that is not a gap in
the instrumentation. Every scope was flagged for a missing `schema_url`, matching the audit.

## Open questions

1. Answered on the issue on 2026-10-02: one package entry with a `modules` list, since the package
   holds all the submodules, the way the Java agent packages its instrumentations
   ([comment](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1187#issuecomment-5949532605)).
2. Implemented in
   [#1272](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1272): both
   repositories share the JS watcher and registry.
3. Answered on 2026-10-18: leave out the five keys the browser repo has no value for (`node_engine`,
   `in_auto_instrumentations_node`, `component_owners`, `supported_versions`, `tested_versions`),
   and leave out an empty optional field instead of writing `""`.
4. Answered on 2026-10-18: read stable `browser-instrumentation-v*` tags, and backfill every missing
   tag. The pull request records a live read of the 11 releases from 0.2.0 through 0.8.2.
5. Partly implemented in
   [#1368](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1368): new
   entries get `platform: browser` when their package keywords include `web`. Still to decide: how
   the five existing packages get it without rewriting immutable registry releases.
6. Is the "JS / Node" home card meant to be Node only?
7. Telemetry: wait for a merged registry, capture from runs, or read the event-name constants now?
8. Should `@opentelemetry/browser-sdk` be tracked, and if so as what?
9. Should a js-contrib browser package be linked to its successor here, and how?
10. Still open: add module names to the index and data types introduced by #990 so its list page can
    search them without fetching every package file.
