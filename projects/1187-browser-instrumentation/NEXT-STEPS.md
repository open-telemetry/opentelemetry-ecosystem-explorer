---
title: "Roadmap - Browser Instrumentation Research"
issue: 1187
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-10-02"
---

## Done

- [x] Audited `opentelemetry-browser` at `0aac882` (`01-metadata-audit.md`)
- [x] Dry run of the JavaScript builder with a browser entry added to a copy of the registry
- [x] Compared three watcher shapes and the presentation options (`02-watcher-and-presentation.md`)

## Proposed steps, each small enough to merge alone

1. A browser source in `js-instrumentation-watcher` that writes the package entry with `modules`
   (`name`, `import_path`, `source_path`), read at release tags.
2. `scope_name` per module, optional and left out when the pattern does not match.
3. An optional `platform` field, if wanted, starting from the `web` keyword.
4. Module names in `index.json` so search on the list page from
   [#990](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/990), still in
   progress, finds a module.
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
2. Can another SIG's repo share the JS watcher, its nightly PR and its failure notification?
3. Should browser entries leave out the five keys the browser repo has no value for, or write them
   with empty values?
4. Read at the release tag or at `main`? If tags, backfill 0.2.0 to 0.8.0 or start at 0.8.1?
5. Is a `platform` field wanted on JS entries? If so, is the `web` keyword the right signal, and how
   should the five existing packages get it, given old files are immutable?
6. Is the "JS / Node" home card meant to be Node only?
7. Telemetry: wait for a merged registry, capture from runs, or read the event-name constants now?
8. Should `@opentelemetry/browser-sdk` be tracked, and if so as what?
9. Should a js-contrib browser package be linked to its successor here, and how?
10. Would the #990 work take module names in `index.json` so search finds a module?
