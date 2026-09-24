---
title: "Roadmap — untrack the explorer database"
issue: 947
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-09-23"
---

## Next steps

Phase 1 is in review in this pull request ([`01-test-suite.md`](./01-test-suite.md)). Phases 2 to 4
have their decisions settled in [`design-decisions.md`](./design-decisions.md) but no phase document
yet.

The `blocking` handler fix from the known-defects table below is in review as
[#1158](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1158). It is
independent of everything here and can land in any order.

## Sequence

Four pull requests on the critical path. Only the last is irreversible; everything before it reverts
with a plain `git revert`.

| #     | What ships                                                                                                                                        | Reversible | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| micro | Add the missing `blocking` handler to `openDB` (see known defects)                                                                                | yes        | in review   |
| 1     | Test suite runs without the generated database, plus these initiative documents                                                                   | yes        | in progress |
| 2     | Producer: builder emits reproducible per-ecosystem archives and the manifest; the nightly publishes releases and detects change by content digest | yes        | not planned |
| 3     | Consumer: the `fetch-database` script wired in front of every consumer, inert while the data is present, plus the equivalence job                 | yes        | not planned |
| 4     | **The flip** — `git rm -r --cached` plus `.gitignore`                                                                                             | **no**     | not planned |

Phase 0 shipped as
[#1155](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1155): the curated
`sdk-configuration-defaults-*.json` files moved out of the builder-owned
`public/data/configuration/` into `public/data/defaults/configuration/`, and
`configuration_builder._clean_output` became uniform with the other two writers. It is a hard
prerequisite, because `gitignore(5)` does not allow re-including a file whose parent directory is
excluded, so the ignore rule for `configuration/` is not expressible while a curated file lives
inside it.

### Deliberately not in the sequence

- **Reviewability gate** (corrected per-ecosystem statistics, the name-based removal check, the
  change report). It can be built and shadow-run against the committed data at any point, and it has
  value on its own. Decisions are settled in
  [`design-decisions.md` §6](./design-decisions.md#6-reviewability).
- **Hygiene**: deleting `orphan_gc`, `_is_current`, `remove_orphans`, the `--clean` flag and the
  `build_mode` input once always-clean lands. A follow-up, done when convenient.

## The dual-run window

Phases 2 and 3 deliberately run the new machinery **while the data is still committed**. That is
what makes phase 4 safe: CI can delete the three generated directories, fetch and unpack the
published archive, and assert `git diff` is empty. Git itself then proves, through the production
producer, that the archive reproduces the tracked tree byte for byte, while the reference copy still
exists.

The `rm -rf` before unpacking is load-bearing: unpacking over the existing tree would hide files the
archive **omits**, which is the failure that matters.

## Gates before phase 4 may merge

- Phase 1 landed; `bunx tsc -b` exits 0 with the three generated directories removed.
- The bootstrap release exists and is **published**, not a draft. Draft assets are not downloadable
  anonymously, and Netlify builds unauthenticated.
- Phase 3's equivalence check is green on several consecutive nightly data pull requests, covering
  at least one collector change, one javaagent change and one configuration change.
- At least one Netlify **production** deploy has built from the release rather than from the
  committed tree.
- Every open `otelbot/automated-explorer-database-update-*` pull request is closed or merged. They
  carry the old large diff and would conflict irreconcilably.
- The nightly schedule is paused for the flip window and re-enabled after the first successful
  post-flip run.

Phase 4 is **roll-forward only**. Reverting it mechanically restores the files, but they are frozen
at flip date, nothing refreshes them, and the fetch script overwrites them on every build. Say so in
the pull request description, so that `git revert` is not the reflex if something looks wrong after
the flip.

## Open decision, owned by phase 2

After the flip the `DB_VERSION` bump loses its trigger, because it keys on git seeing files change
under `public/data`. Phase 2 must choose between keeping the integer and splitting schema version
from data version. Both options, the evidence and the recommendation (the split) are in
[`design-decisions.md` §4](./design-decisions.md#4-browser-cache-invalidation).

## Known defects recorded during design

| What                                                                                                                                                                                                                                                          | Where                                                                                                | Disposition                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `openDB` registers no `blocking` handler, so after a `DB_VERSION` bump a user with an old tab open waits on a promise that never resolves and never rejects, so nothing is logged                                                                             | `ecosystem-explorer/src/lib/api/idb-cache.ts:77`                                                     | fixed in [#1158](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1158) |
| Two open data pull requests make the identical `DB_VERSION` 28→29 edit; git's 3-way merge accepts the second silently, so the second merge never invalidates any cache                                                                                        | `.github/workflows/build-explorer-database.yml:212-227`                                              | **disappears** if phase 2 takes the split; persists if it keeps the integer                    |
| Content-addressed entries expire after 24 hours like everything else, so the 91.7% of the cache that can never go stale is refetched daily                                                                                                                    | `ecosystem-explorer/src/lib/api/idb-cache.ts:20`                                                     | addressed by the `immutable: true` flag in the phase 2 recommendation                          |
| Five `core-x*` packages are listed as deprecated in 0.159.0; they were never components and still ship upstream, so the site shows 9 deprecations where 4 are real. The root cause (#991) is fixed in #993, but only for versions extracted after that landed | `ecosystem-registry/collector/deprecations.yaml`, `ecosystem-automation/collector-watcher/README.md` | registry-side and out of scope here; needs its own issue for the already-published versions    |
| Corpus files selected by mtime, which is extraction time once data arrives by untar                                                                                                                                                                           | `ecosystem-explorer/src/lib/normalize-instrumentation.test.ts`                                       | the selection was removed in phase 1, task 3                                                   |

## Decision log

| Date       | Decision                                                                                                                               | Rationale                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | Four pull requests, not eight                                                                                                          | The finer splits did not earn their keep. Only the flip must stand alone, because bundling it makes otherwise reversible work irreversible                                                               |
| 2026-09-23 | Build from empty every night; never restore the previous archive                                                                       | Warm incremental measured at 12.50s against 12.34s for clean, so the optimization buys nothing, while restore carries silent corruption forward forever and breaks the issue's own reproducibility claim |
| 2026-09-23 | Per-ecosystem archives, with `release_tag` and `registry_commit` inside each ecosystem's block rather than in a shared top-level block | With one shared block every pull request edits the same lines; a stale second merge would silently revert another ecosystem's data and show only a changed hex string                                    |
| 2026-09-23 | Download the pinned asset; no automatic fallback to a local build                                                                      | A fallback produces different content, so one network blip would promote unreviewed registry content straight to production                                                                              |
| 2026-09-23 | No fixture corpus; corpus-reading tests become integration tests                                                                       | Each exists to meet shapes a frozen snapshot would hide, and the job that runs them needs the data anyway, so fixtures save nothing                                                                      |
| 2026-09-23 | `data-manifest.json` lives at `ecosystem-explorer/public/data-manifest.json`                                                           | Netlify's `base` is `ecosystem-explorer` and no `ignore` command is set, so a manifest at the repository root would leave the promotion merge building nothing                                           |
