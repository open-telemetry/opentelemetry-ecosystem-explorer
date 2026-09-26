---
title: "Roadmap — untrack the explorer database"
issue: 947
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-09-24"
---

## Next steps

Phase 1 merged on 2026-09-24 ([`01-test-suite.md`](./01-test-suite.md)), as did the `blocking`
handler fix from the known-defects table below. Phase 2 is written up in
[`02-producer.md`](./02-producer.md), implemented, and rehearsed on a fork on 2026-09-24. What that
rehearsal established, and the one question it could not answer, are recorded in that document.
Phases 3 and 4 have their decisions settled in [`design-decisions.md`](./design-decisions.md) but no
phase document yet.

## Sequence

Five pull requests on the critical path. Only the last is irreversible; everything before it reverts
with a plain `git revert`.

| #     | What ships                                                                                                                                        | Reversible | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| micro | Add the missing `blocking` handler to `openDB` (see known defects)                                                                                | yes        | merged      |
| 1     | Test suite runs without the generated database, plus these initiative documents                                                                   | yes        | merged      |
| 2     | Producer: builder emits reproducible per-ecosystem archives and the manifest; the nightly publishes releases and detects change by content digest | yes        | in progress |
| split | `DB_VERSION` becomes schema-only, each cache entry carries the content id, and the `sed` bump step is deleted in the same change                  | yes        | not planned |
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
- **Hygiene**: deleting `orphan_gc`, `_is_current`, `remove_orphans` and the builder's `--clean`
  flag, now that every build is a clean build. A follow-up, done when convenient. The workflow's
  `build_mode` input went with phase 2, because an input that no longer changes anything is worse
  than no input at all.

## The dual-run window

Phases 2 and 3 deliberately run the new machinery **while the data is still committed**. That is
what makes phase 4 safe: CI can delete the three generated directories, fetch and unpack the
published archive, and assert `git diff` is empty. Git itself then proves, through the production
producer, that the archive reproduces the tracked tree byte for byte, while the reference copy still
exists.

The `rm -rf` before unpacking is load-bearing: unpacking over the existing tree would hide files the
archive **omits**, which is the failure that matters.

## Gates before phase 4 may merge

- Phase 1 landed; `bunx tsc -b` exits 0 with the three generated directories removed. Done.
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

## The decision phase 2 owned, now closed

After the flip the `DB_VERSION` bump loses its trigger, because it keys on git seeing files change
under `public/data`. Phase 2 chose **the split**, as recommended in
[`design-decisions.md` §4](./design-decisions.md#4-browser-cache-invalidation): `DB_VERSION` becomes
a schema-only integer, each cache entry carries the content id it was written under, and an explicit
`immutable: true` flag exempts content-addressed entries from both the stamp and the 24-hour expiry.

It ships in a pull request of its own, between phases 2 and 3, and that pull request **must delete
the `sed` bump step in the same change**. Leaving the step in place lets the next nightly increment
the integer anyway, which turns any later deploy rollback into a permanent `VersionError`. The
reasoning is in
[`02-producer.md`](./02-producer.md#1-db_version-takes-the-split-in-a-pull-request-of-its-own).

The deadline is phase 4, not phase 2: while `public/data/` is tracked, the existing bump keeps
working.

## Known defects recorded during design

| What                                                                                                                                                                                                                                                          | Where                                                                                                | Disposition                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `openDB` registers no `blocking` handler, so after a `DB_VERSION` bump a user with an old tab open waits on a promise that never resolves and never rejects, so nothing is logged                                                                             | `ecosystem-explorer/src/lib/api/idb-cache.ts:77`                                                     | fixed in [#1158](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1158) |
| Two open data pull requests make the identical `DB_VERSION` 28→29 edit; git's 3-way merge accepts the second silently, so the second merge never invalidates any cache                                                                                        | the `Increment DB cache schema version` step of `build-explorer-database.yml`                        | **disappears** with the split, which is now decided; see the `split` row in the sequence       |
| Content-addressed entries expire after 24 hours like everything else, so the 91.7% of the cache that can never go stale is refetched daily                                                                                                                    | `ecosystem-explorer/src/lib/api/idb-cache.ts:20`                                                     | addressed by the `immutable: true` flag, part of the `split` pull request                      |
| Five `core-x*` packages are listed as deprecated in 0.159.0; they were never components and still ship upstream, so the site shows 9 deprecations where 4 are real. The root cause (#991) is fixed in #993, but only for versions extracted after that landed | `ecosystem-registry/collector/deprecations.yaml`, `ecosystem-automation/collector-watcher/README.md` | registry-side and out of scope here; needs its own issue for the already-published versions    |
| Corpus files selected by mtime, which is extraction time once data arrives by untar                                                                                                                                                                           | `ecosystem-explorer/src/lib/normalize-instrumentation.test.ts`                                       | the selection was removed in phase 1, task 3                                                   |

## Decision log

| Date       | Decision                                                                                                                               | Rationale                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | Four pull requests, not eight                                                                                                          | The finer splits did not earn their keep. Only the flip must stand alone, because bundling it makes otherwise reversible work irreversible                                                                                                                                               |
| 2026-09-23 | Build from empty every night; never restore the previous archive                                                                       | Warm incremental measured at 12.50s against 12.34s for clean, so the optimization buys nothing, while restore carries silent corruption forward forever and breaks the issue's own reproducibility claim                                                                                 |
| 2026-09-23 | Per-ecosystem archives, with `release_tag` and `registry_commit` inside each ecosystem's block rather than in a shared top-level block | With one shared block every pull request edits the same lines; a stale second merge would silently revert another ecosystem's data and show only a changed hex string                                                                                                                    |
| 2026-09-23 | Download the pinned asset; no automatic fallback to a local build                                                                      | A fallback produces different content, so one network blip would promote unreviewed registry content straight to production                                                                                                                                                              |
| 2026-09-23 | No fixture corpus; corpus-reading tests become integration tests                                                                       | Each exists to meet shapes a frozen snapshot would hide, and the job that runs them needs the data anyway, so fixtures save nothing                                                                                                                                                      |
| 2026-09-24 | Every workflow step that calls `gh` pins `GH_REPO` to `github.repository`                                                              | `gh` resolves a fork's parent when no repository is given, so a `workflow_dispatch` rehearsal on a personal fork could have created releases or pull requests on the upstream repository                                                                                                 |
| 2026-09-23 | One release per ecosystem, tagged `data-<ecosystem>-<first 12 hex of content_digest>`, never deleted                                   | The nightly publish path reruns for byte-identical content, and an organization ruleset makes tags immutable. A digest-derived tag is idempotent: unchanged content already has its tag, so the run publishes nothing. Deleting a release would make every commit pinning it unbuildable |
| 2026-09-23 | Packing, both digests and the manifest live in the Python builder; only the `gh` calls stay in the workflow                            | `db-builder-integration.yml` already builds clean on every relevant pull request, so the computation gets regression coverage for free. `tarfile` was re-verified as byte-deterministic, and unlike shelling out to `tar` it behaves the same on macOS                                   |
| 2026-09-23 | The `DB_VERSION` split ships in its own pull request between phases 2 and 3                                                            | It is the only part of #947 that runs in users' browsers, and the pull request that introduces it must delete the `sed` bump step in the same change                                                                                                                                     |
| 2026-09-23 | `data-manifest.json` lives at `ecosystem-explorer/public/data-manifest.json`                                                           | Netlify's `base` is `ecosystem-explorer` and no `ignore` command is set, so a manifest at the repository root would leave the promotion merge building nothing                                                                                                                           |
