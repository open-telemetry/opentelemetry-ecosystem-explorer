---
title: "Watcher and Presentation - Browser Instrumentation"
issue: 1187
type: brief
phase: meta
status: in-progress
last_updated: "2026-10-02"
---

Answers to the four questions in
[issue #1187](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1187), in
the issue's order. Browser repo evidence is in [`01-metadata-audit.md`](./01-metadata-audit.md).

## Modules worth tracking

All nine exported modules, at module granularity inside one package entry: console, errors, fetch,
navigation, navigation-timing, resource-timing, user-action, web-vitals and xhr. The rule is every
`exports` key whose last segment has a `src/<name>/index.ts` (`utils` is not exported), so new
modules come in with the release that ships them. Two are in open PRs,
[opentelemetry-browser#429](https://github.com/open-telemetry/opentelemetry-browser/pull/429)
(long-animation-frame) and
[opentelemetry-browser#396](https://github.com/open-telemetry/opentelemetry-browser/pull/396)
(element-timing). Left out for now: `@opentelemetry/browser-sdk`, which is not an instrumentation,
and the older fetch and XHR packages in opentelemetry-js, which are outside both watched repos.

## State of the metadata

See the audit. Identity data is in the repo today, in the same form at all ten release tags.
Telemetry exists only as TypeScript, and its conventions are moving into a registry.

## Coupled or separate watcher

Proposed: a second source inside `js-instrumentation-watcher`, writing into
`ecosystem-registry/javascript/`, and no second watcher for now. The collector watcher already sets
up two repositories in one watcher
([`repository_manager.py`](../../ecosystem-automation/collector-watcher/src/collector_watcher/repository_manager.py)
lines 32-40), the precedent the issue mentions.

A dry run checked the builder side. The package entry, derived with `git show` at the release tag,
went into a copy of `ecosystem-registry/javascript/`, and the unmodified `run_javascript_builder`
ran on it through an `InventoryManager`. It exited 0 with 49 packages in `index.json` and all nine
`modules` in the release file. The builder only insists that `name` matches the directory
([`javascript_builder.py`](../../ecosystem-automation/explorer-db-builder/src/explorer_db_builder/javascript_builder.py)
lines 91-92).

The parse step is not shared. The JS scanner only looks at `packages/instrumentation-*`
([`package_scanner.py`](../../ecosystem-automation/js-instrumentation-watcher/src/js_instrumentation_watcher/package_scanner.py)
lines 26-27), and the parser takes `name` from the directory and hard-codes the repository
([`package_parser.py`](../../ecosystem-automation/js-instrumentation-watcher/src/js_instrumentation_watcher/package_parser.py)
lines 72 and 95), so the browser source needs its own small reader.

Three shapes were compared.

|                        | Entry per module, same watcher                                                | Separate watcher and tree                                       | Label now, watch later                 |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Registry location      | `javascript/browser-instrumentation-<module>/v{version}.yaml`                 | `browser/instrumentation/v{version}/instrumentation.yaml`       | none, or one package entry             |
| Workflow, CI, frontend | no change, facet on the #990 list page                                        | new workflow, CI step, workspace entry, new ecosystem in the UI | no change, facet on the #990 list page |
| Main weakness          | nine near-identical files per release, module names that are not npm packages | cost and review load before any page can show it                | leaves readily available data unused   |

The proposal mixes them. It keeps the JavaScript tree and workflow of the first, writes one package
entry with a `modules` list as the third would, and reads at release tags. The cost is that until
the list page reads `modules`, a user sees one row for nine instrumentations and a search for
"fetch" misses it.

Reading at release tags keeps each file equal to what was published (the 0.7.0 case in the audit),
though the shared code assumes plain `v` tags in two places. The tag parser strips only a leading
`v` (`ecosystem-automation/watcher-common/src/watcher_common/version_detector.py:56`), and
`checkout_version` rebuilds the ref as `v{version}` (line 90 of the same file, also
`watcher_common/repository_manager.py:142`). So a `browser-instrumentation-v*` tag is neither found
nor checked out. Either both learn the prefix, or the watcher reads files with `read_file_at_ref`
(line 119), which takes any ref and needs no checkout. Reading `main` like the js-contrib path is
simpler (open question 4).

## Telemetry

Deferred, with a trigger. The JS project already treats telemetry as a non-goal for now
([`NEXT-STEPS.md`](../9-javascript-instrumentation/NEXT-STEPS.md) lines 17-18), and here the only
source is TypeScript that the open base class refactor touches in every module (audit, upstream item
3). Trigger: a browser convention registry merged on a default branch, or data captured from a
conformance-style run, which gets it per module without parsing TypeScript (`NEXT-STEPS.md`).

## Presentation

Proposed: show it with JavaScript, with a browser filter once the list page from
[#990](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/990) exists, not as
a separate ecosystem yet.

- The IA recommendation describes ecosystems as "each language or tool"
  ([`ecosystem-explorer-ia-recommendation.md`](../ux-research-and-info-arc/ecosystem-explorer-ia-recommendation.md)
  lines 118-121). The browser package is JavaScript the language. The tool-shaped thing would be the
  browser SDK, which bundles no instrumentations today.
- The guiding principles look at how components are "built, distributed, versioned, and discovered"
  to decide how they "should be grouped and named"
  ([`guiding-principles-for-ecosystems.md`](../ux-research-and-info-arc/guiding-principles-for-ecosystems.md)
  lines 101-106). That can support either answer, since the browser package has its own repo and
  release train but is JavaScript. GenAI gets no branch and works as "a discovery and comparison
  layer" (same file, lines 120-124), and a filter would too.
- Five js-contrib browser packages are already in the JavaScript tree, and upstream plans to migrate
  or deprecate them (browser repo `docs/roadmap.md:54-59`). One list with a filter shows both, and a
  separate ecosystem would touch closed lists in the frontend such as
  [`types.ts`](../../ecosystem-explorer/src/v1/features/ecosystem/types.ts) line 50.

The browser entry can be told apart by `repository`, while the five js-contrib packages cannot. Of
the 48 `packages/instrumentation-*/package.json` files in js-contrib at `7b3e8453` (fetched with
`gh api`), the `web` keyword is in exactly those five. The browser package has it too (browser repo
`package.json:7-8`), so an optional `platform` field could cover them (open question 5).

The home card label is "JS / Node"
([`home.json`](../../ecosystem-explorer/public/locales/en/home.json) line 78). If that card is meant
to be Node only, the answer changes to a separate ecosystem.

## When to revisit

The browser roadmap has no dates (browser repo `docs/roadmap.md:9`). Modules leaving
`./experimental/` change `import_path` while `name` stays. If the SDK ships a default
instrumentation set or reaches 1.0 (browser repo `docs/roadmap.md:125-135`), the separate ecosystem
question is worth reopening.

## Not confirmed

- Whether the registry drafts in the audit merge, and which repo ends up holding the registry.
- That `git pull` on the cached clone in CI brings new release tags (default behaviour, not run).
- How the #990 pages will read `index.json`, and whether missing keys on a browser entry break them.
- `auto-instrumentations-web`, which the scan did not cover.
