---
title: "Metadata Audit - Browser Instrumentation"
issue: 1187
type: audit
phase: 1
status: in-progress
last_updated: "2026-10-01"
---

Analysis of the `opentelemetry-browser` repository at `0aac882` (2026-10-01), plus a keyword scan of
`opentelemetry-js-contrib` at `7b3e8453`. Findings are from file contents and the commands quoted
next to them. Paths in backticks are in the browser repo unless they start with `ecosystem-`, and
`package.json` alone means `packages/instrumentation/package.json`. Other files in this repo are
linked.

## Repository overview

- One instrumentation package, `@opentelemetry/browser-instrumentation` 0.8.1 (`package.json:2-3`).
  Its nine instrumentations are subpath exports under `./experimental/` (`package.json:34-44`) and
  share that version. The build takes every `src/*/index.ts` except `utils`
  (`packages/instrumentation/tsdown.config.ts:6`). `utils` is not exported.
- A second package, `@opentelemetry/browser-sdk`, is released as its own component
  (`release-please-config.json:7-14`). It registers the instrumentations it is given and has no
  default set (`packages/sdk/src/startBrowserSdk.ts:165-169,228-230`).
- Ten release tags, `browser-instrumentation-v0.2.0` to `-v0.8.1`
  (`git tag --list "browser-instrumentation-v*"`). npm has eleven versions, 0.1.0 on 2026-03-12 to
  0.8.1 on 2026-09-09 (`npm view @opentelemetry/browser-instrumentation time --json`). A 0.8.2
  release PR is open,
  [opentelemetry-browser#426](https://github.com/open-telemetry/opentelemetry-browser/pull/426).

## What is machine-readable today

Everything a first registry entry needs is in `package.json` and the source tree:

| Field                   | Source                                                                   | Notes                                                         |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `name`                  | `package.json:2` without the `@opentelemetry/` scope                     | as in all 48 JS packages, where it is also the directory name |
| `npm_package`           | `package.json:2`                                                         |                                                               |
| `version`               | `package.json:3`                                                         | one version for all modules, equals tag suffix                |
| `description`           | `package.json:4`                                                         | one sentence for the whole package                            |
| `repository`            | `repository.url` at `package.json:26`, reduced to `owner/repo`           |                                                               |
| `source_path`           | `repository.directory` at `package.json:27`                              |                                                               |
| `modules[].name`        | last segment of each `exports` key, kept if `src/<name>/index.ts` exists | sort key for the list                                         |
| `modules[].import_path` | npm name plus the `exports` key                                          | all under `./experimental/` today                             |
| `modules[].source_path` | `packages/instrumentation/src/<name>`                                    |                                                               |
| `modules[].scope_name`  | string in the `super('...')` call of `src/<name>/instrumentation.ts`     | second step, optional                                         |

Per module, from source rather than any manifest (paths under `packages/instrumentation/src/`):

| Module            | Emits                                 | Name defined at                   | Scope name at                             |
| ----------------- | ------------------------------------- | --------------------------------- | ----------------------------------------- |
| console           | log event `browser.console`           | `console/semconv.ts:15`           | `console/instrumentation.ts:57`           |
| errors            | log event `exception`                 | `errors/instrumentation.ts:21`    | `errors/instrumentation.ts:33`            |
| fetch             | CLIENT span                           | -                                 | `fetch/instrumentation.ts:57`             |
| navigation        | log event `browser.navigation`        | `navigation/semconv.ts:12`        | `navigation/instrumentation.ts:69`        |
| navigation-timing | log event `browser.navigation_timing` | `navigation-timing/semconv.ts:12` | `navigation-timing/instrumentation.ts:59` |
| resource-timing   | log event `browser.resource_timing`   | `resource-timing/semconv.ts:17`   | `resource-timing/instrumentation.ts:74`   |
| user-action       | log event `browser.user_action.click` | `user-action/semconv.ts:12`       | `user-action/instrumentation.ts:39`       |
| web-vitals        | log event `browser.web_vital`         | `web-vitals/semconv.ts:12`        | `web-vitals/instrumentation.ts:49`        |
| xhr               | CLIENT span                           | -                                 | `xhr/instrumentation.ts:63`               |

The spans start at `fetch/instrumentation.ts:325-326` and `xhr/instrumentation.ts:239-240`. Every
scope name is `@opentelemetry/browser-instrumentation/<directory>` with the package version
(`console/instrumentation.ts:9`), so it is the one per-module string that could join a module to
telemetry from a later source.

## What exists but is inconsistent

- The package README lists eight instrumentations for nine modules, with no XHR bullet
  (`packages/instrumentation/README.md:16-23`). Its XHR attribute table opens with "Each `fetch`
  Span includes:" (same file, line 383).
- Event names are constants in per-module `semconv.ts` files, except errors, which keeps a local
  literal (`errors/instrumentation.ts:21`). Upstream calls these constants "bare strings, not
  definitions" in
  [opentelemetry-browser#403](https://github.com/open-telemetry/opentelemetry-browser/issues/403).
- The closest thing to a catalogue is a hand-written status table with seven event rows and none for
  fetch or XHR (`docs/browser-observability-model.md:44-52`).
- Browser packages in other repos are listed in a hand-edited README table, which marks the
  opentelemetry-js fetch and XHR packages deprecated (`README.md:107-108`). npm does not
  (`npm view @opentelemetry/instrumentation-fetch deprecated --json` prints nothing).

## What is missing entirely

- `engines`, `.tav.yml` and a per-package owners file. No `package.json` has `engines`,
  `git ls-files` matches no `.tav.yml` or `component_owners` file, and `.github/CODEOWNERS` is one
  team line.
- Supported browser versions. The roadmap says a compatibility statement "remains to be documented"
  (`docs/roadmap.md:145-151`).
- Any machine-readable telemetry description. There is no `semconv/` directory on `main`, and
  `git grep -nI 'schema_url\|schemaUrl\|opentelemetry.io/schemas' -- . ':!package-lock.json'` finds
  nothing.
- Per-module description, stability and configuration as data, and a default-enabled set.

## Proposed registry schema

A first draft from `package.json` and the source tree at the `browser-instrumentation-v0.8.1` tag.
It only holds fields with a source in the browser repo today.

```yaml
# ecosystem-registry/javascript/browser-instrumentation/v0.8.1.yaml
description: OpenTelemetry browser instrumentations.
modules:
  - import_path: "@opentelemetry/browser-instrumentation/experimental/console"
    name: console
    scope_name: "@opentelemetry/browser-instrumentation/console"
    source_path: packages/instrumentation/src/console
  # errors, fetch, navigation, navigation-timing, resource-timing, user-action, web-vitals, xhr
  # follow with the same four keys, sorted by name
name: browser-instrumentation
npm_package: "@opentelemetry/browser-instrumentation"
repository: open-telemetry/opentelemetry-browser
source_path: packages/instrumentation
version: 0.8.1
```

`modules` is sorted by `name` because the content hash does not sort lists
([`ecosystem-mapping-schema-design.md`](../../docs/ecosystem-mapping-schema-design.md) lines 52-60).
It is a list of mappings so optional keys can be added per module later.

Left out because the browser repo has no value for them: `node_engine` (no `engines`),
`in_auto_instrumentations_node` (a Node bundle the package is not in), `component_owners` (no owners
file) and `supported_versions` and `tested_versions` (no target library, no `.tav.yml`). The five
js-contrib browser packages write `in_auto_instrumentations_node: false` and `[]` for both version
lists (`ecosystem-registry/javascript/instrumentation-web-exception/v0.15.0.yaml`), which is the
alternative. Both pass the builder, which reads every index field except `name` with `.get()`
([`javascript_builder.py`](../../ecosystem-automation/explorer-db-builder/src/explorer_db_builder/javascript_builder.py)
lines 41-48).

Present today but deferred, as the schema guide asks
([`ecosystem-mapping-schema-design.md`](../../docs/ecosystem-mapping-schema-design.md) lines 38-42):

| Candidate              | Where it is                                       | Why deferred                                      |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------- |
| per-module description | `packages/instrumentation/README.md:16-23`        | hand-written, eight bullets for nine modules      |
| signals per module     | `logger.emit` and `tracer.startSpan` calls        | inferred from source, base class refactor pending |
| event names            | `semconv.ts` constants and one literal in errors  | being moved to a registry (issue 403)             |
| `platform`             | `browser` and `web` keywords (`package.json:7-8`) | touches existing JS entries, needs a decision     |

## What requires upstream work

1. **A convention registry.** Draft PR
   [opentelemetry-browser#404](https://github.com/open-telemetry/opentelemetry-browser/pull/404)
   adds one under `semconv/` and says "Nothing is generated from the registry yet."
   [semantic-conventions-client-side#12](https://github.com/open-telemetry/semantic-conventions-client-side/pull/12)
   (registry scope for platform-specific conventions) merged on 2026-09-30, and
   [semantic-conventions-client-side#14](https://github.com/open-telemetry/semantic-conventions-client-side/pull/14)
   (browser conventions) is a draft. Of the seven log events, semantic-conventions
   [v1.44.0](https://github.com/open-telemetry/semantic-conventions/tree/v1.44.0/model) already
   defines `browser.web_vital` (development) and `exception` (stable).
2. **A link from module to telemetry.** A registry lists events and attributes, not which module
   emits which. A small per-module manifest upstream would. It is a possible ask, not one made yet.
3. **The base class refactor.** Open PR
   [opentelemetry-browser#278](https://github.com/open-telemetry/opentelemetry-browser/pull/278)
   moves every module to a new `InstrumentationBase` (`docs/roadmap.md:90-91`), so anything read
   from `instrumentation.ts` by pattern may need updating.

## Versioning model

One version per package, shared by all modules and released by release-please per component. The
module count at each tag from 0.2.0 to 0.8.1 is 3, 4, 6, 7, 7, 7, 7, 7, 9, 9
(`git show <tag>:packages/instrumentation/package.json`, keeping `exports` keys that have a
`src/<name>/index.ts` at that tag).

`main` and the published versions can disagree between releases. On 2026-08-10 `main` had
`./experimental/fetch` while the version was still 0.7.0
(`git show 7bba31f:packages/instrumentation/package.json`), and the published 0.7.0 has no fetch
export (`npm view @opentelemetry/browser-instrumentation@0.7.0 exports --json`). That argues for a
package key read at release tags, the per-package layout JS already uses:
`ecosystem-registry/javascript/browser-instrumentation/v{version}.yaml`.
