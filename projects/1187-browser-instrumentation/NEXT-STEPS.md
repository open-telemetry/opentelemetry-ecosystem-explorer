---
title: "Roadmap - Browser Instrumentation Research"
issue: 1187
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-11-05"
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
       ([#1368](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1368)). The
       initial change left existing registry releases unchanged.
       [#1372](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1372) then
       rebuilt the JavaScript registry with platform metadata and published it in `index.json`.
4. [x] Module names in `index.json` and the TypeScript data types
       ([#1370](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1370)). The
       list page from
       [#990](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/990) is
       still in progress. Its search can use `module_names` without fetching every package file.
5. Telemetry, once the trigger in `02-watcher-and-presentation.md` fires.

## Telemetry from a run

The explorer imports the published reports of
[semantic-conventions-conformance](https://github.com/open-telemetry/semantic-conventions-conformance)
through the conformance watcher merged in
[#1188](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1188). A trial ran
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
5. Implemented in
   [#1368](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1368): new
   entries get `platform: browser` when their package keywords include `web`.
   [#1372](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1372) rebuilt the
   existing registry records with platform metadata and added the field to the index.
6. Is the "JS / Node" home card meant to be Node only?
7. Telemetry: wait for a merged registry, capture from runs, or read the event-name constants now?
8. Answered on 2026-11-03: keep SDKs out, consistent with the other languages
   ([discussion](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1371#discussion_r4454151697)).
   The SDK tracking PR was closed without merging.
9. Implemented for browser navigation in
   [#1373](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1373): the index
   links the js-contrib package to the browser navigation module through `related`. The note says
   its event API is not a drop-in replacement. Historical package files stay unchanged.
10. Implemented in
    [#1370](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1370): the index
    and data types expose sorted, unique `module_names` from the latest release. List-page search
    remains with #990.
