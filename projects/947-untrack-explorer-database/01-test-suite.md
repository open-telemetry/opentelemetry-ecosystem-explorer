---
title: "Phase 1 — Data-independent test suite"
issue: 947
type: plan
phase: 1
status: in-progress
last_updated: "2026-09-23"
---

> [!NOTE]
>
> The sequence and the gates live in [`NEXT-STEPS.md`](./NEXT-STEPS.md). The decisions behind this
> phase are in [`design-decisions.md`](./design-decisions.md).

## Phase 1 — Data-independent test suite

## TL;DR

Make `bun run typecheck` and `bun run test` pass on a checkout where
`ecosystem-explorer/public/data/{javaagent,collector,configuration}/` are absent. One static JSON
import becomes a runtime read; three test groups that read the real corpus move to the integration
suite. No fixture corpus is introduced.

## Goal

Remove the coupling between the generated database and everything that must keep working without it:
`tsc`, the CodeQL analysis job, the pre-commit hook, and the unit suite. This is a hard prerequisite
for every later phase, and it ships value on its own even if #947 is abandoned.

## Scope (in)

- Replace the single static import of `public/data/javaagent/versions-index.json` with a runtime
  read.
- Move three corpus-reading test groups into the integration suite: the registry snapshot in
  `normalize-instrumentation.test.ts`, `starter-template.test.ts`, and the corpus half of
  `scripts/generate-agent-docs.test.ts`.
- Renaming is sufficient for the two under `src/`: `vitest.config.ts:31` excludes
  `**/*.integration.test.{ts,tsx}` and `vitest.integration.config.ts:32` includes
  `src/**/*.integration.test.{ts,tsx}`. `scripts/generate-agent-docs.test.ts` sits outside `src/`,
  so the integration config's `include` must also gain `scripts/**/*.integration.test.{ts,tsx}`, or
  that file would leave the unit suite without joining the integration suite and stop running
  entirely.
- Add a `globalSetup` guard so a missing database aborts the integration suite in under two seconds
  with an actionable message, instead of roughly 90 seconds of DOM dumps and tests reported as
  skipped.
- Resolve the registry snapshot's corpus through the production loader rather than by listing
  directories and sorting by mtime.
- Replace the `>= 250` and `>= 170` count floors with vacuity guards.
- Parametrize the starter template test over every file in `public/data/defaults/configuration/`.
- Add a CI job asserting typecheck and the unit suite pass with the three directories deleted.
- Document the resulting rule in `ecosystem-explorer/AGENTS.md`.

## Out of scope

- Any change to the builder, the workflows that publish data, or `netlify.toml`.
- The producer-side contract gate (running `test:integration` inside `build-explorer-database.yml`
  before upload) — that belongs to phase 2, which owns that workflow.
- Ordering `lint` and `test` before a fetch step in CI — phase 3 owns the fetch step.

## Dependencies

Phase 0 ([#1155](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1155)),
merged. The starter templates must already live at `public/data/defaults/configuration/` for the
parametrized test to find them.

## Why no fixtures

No fixture corpus is introduced. The argument, and the measurements behind it, are in
[`design-decisions.md` §5](./design-decisions.md#5-test-strategy).

## Tasks

| #   | Task                                                                                       | Deliverable                                                         |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Remove the static data import                                                              | `bunx tsc -p tsconfig.app.json` exits 0 with the data removed       |
| 2   | Fail fast when the generated data is absent, and widen the integration include             | The integration suite aborts in under two seconds naming the remedy |
| 3   | Move the registry snapshot test, resolve it through the production loader, drop its floors | `normalize-instrumentation.test.ts` passes with the data removed    |
| 4   | Move the starter template test and cover every starter                                     | Both 1.0.0 and 1.1.0 are verified                                   |
| 5   | Move the agent-docs corpus tests                                                           | The unit half passes with the data removed                          |
| 6   | Lock the property in CI                                                                    | A new data-reading unit test fails the pull request                 |
| 7   | Write down the rule in `ecosystem-explorer/AGENTS.md`                                      | A contributor meets the reason before the red build                 |

## Acceptance criteria

- `bunx tsc -b` exits 0 with the three generated directories removed.
- `bun run test` passes with the three generated directories removed.
- `bun run test:integration` aborts in under two seconds with an actionable message when they are
  removed, and passes when they are present.
- Both starter templates on disk are verified, not only 1.0.0.
- No test selects a file by mtime.
- CI enforces all of the above on every pull request.
- `ecosystem-explorer/AGENTS.md` states the rule.

## Open questions

None blocking.

## Follow-ups

- The mtime selection fixed in task 3 is currently only latent. It becomes a real defect once data
  arrives by untar, because mtime is then extraction time.
- The `instrumentation-list.integration.test.tsx` `beforeAll` throw reports its tests as _skipped_
  rather than failed. Task 2's guard hides the symptom; whether the suite should also fail loudly on
  a `beforeAll` throw is a separate question.
- `expect(modules.length).toBeLessThan(entries.length)` in
  `normalize-instrumentation.integration.test.ts` is inherited from the test it replaces. It asserts
  that at least one module groups two or more entries, so a legitimate upstream change could fail it
  for a pure data reason — the same objection that justified removing the count floors.
- The `statSync` catch-all in `src/test/integration/global-setup.ts` reports a permissions error as
  a missing database, so the remedy it prints would not help in that case.
