---
title: "Design decisions — untrack the explorer database"
issue: 947
type: brief
phase: meta
status: in-progress
last_updated: "2026-09-23"
---

## Design decisions

Six decisions, each with the alternatives considered and the evidence that settled it. Measurements
were taken at `979b9046` on 2026-09-23 against a checkout of the real tree.

---

## 1. Build topology: always from empty

**Question.** The builder's incremental mode reads back its own previous output. After untracking,
that output is not in the checkout. Restore the pinned archive before building, or start empty?

**Decision. Always `--clean`, always all ecosystems.** Keep the per-ecosystem `workflow_dispatch`
input, but it selects what gets **promoted**, not what gets built.

**Evidence.**

| Run                                          | Time   | Result             |
| -------------------------------------------- | ------ | ------------------ |
| `--clean`, all three pipelines               | 12.34s | 2,046 files        |
| incremental into an empty directory          | 12.66s | identical to clean |
| incremental over a fully populated directory | 12.50s | identical to clean |
| `--clean` versus the committed tree          | —      | identical          |

Warm incremental is not faster, and the asymptotics are the same: the builder loads, transforms,
corrects, backfills and hashes every version either way. `exists()` only skips a `write()`. In CI
the clean build takes 22 seconds and already runs on every builder or registry pull request.

Three drift channels were proven by tampering with a copy of the tree and rebuilding:

1. **Silent corruption is carried forward forever.** Editing a content-addressed JSON file left it
   untouched by the next incremental build: `collector_database_writer.py:163` checks that a file
   _exists_ at a hashed path, never that its content actually hashes to that name.
2. **Stale version indexes are never swept.** `orphan_gc._sweep` covers components, bundles and
   markdown (`orphan_gc.py:136-138`) but never `versions/`, and every `versions/*-index.json` is
   treated as a live reachability root (`:98`), so a stale index keeps ghost content alive. The
   registry does drop versions: `97f27678` deleted collector v0.144.0 through v0.153.0.
3. **`configuration_builder` has no read-back and no GC at all**, so a dropped version's file leaks
   forever.

Restoring would also weaken the reproducibility property the issue relies on, that any historical
state can be rebuilt from the registry: the published artifact would become a function of the
registry, the builder **and every previous archive in the chain**.

**Consequence.** `orphan_gc` (149 lines), `_is_current`, `remove_orphans`, the `--clean` flag and
the `build_mode` input become unreachable. Remove them in a follow-up phase, not inside #947.

---

## 2. Archive granularity and manifest shape

**Question.** One `data.tar.gz` for everything, or one per ecosystem? And where do `release_tag` and
`registry_commit` live?

**Decision. Per-ecosystem archives, each ecosystem's block self-contained.** This refines the sketch
in the issue body, which places `release_tag`, `registry_commit` and `archive_sha256` in a shared
top-level `build` block; the evidence below is why they move into each ecosystem's block instead.

**Evidence.** With one archive and one `archive_sha256`, two open data pull requests rewrite the
same field. If the second was built from a tree predating the first, merging it **silently reverts
the other ecosystem's data**, and the diff shows only a changed hex string, with nothing in it to
indicate which ecosystems the build covered.

Git merges the manifest three-way against the common ancestor, so per-ecosystem blocks that are
physically separated merge cleanly and order-independently. The `main` ruleset does **not** require
branches to be up to date, so stale pull requests do merge; the manifest's shape, rather than branch
protection, is what keeps that safe.

Per-ecosystem promotion is genuinely used:
[#889](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/889) (javaagent),
[#660](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/660) (configuration),
[#630](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/630) and
[#529](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/529). It requires a
per-ecosystem `registry_commit` as well, or the manifest stops being reproducible from the registry.

**Two digests, answering different questions.**

- `content_digest` — over the sorted `(relative path, sha256)` pairs of the **unpacked** tree. This
  is the change-detection key and the browser cache key.
- `archive_sha256` — over the served bytes. Transport integrity only.

Change detection must never key on `archive_sha256`: `tar` and `gzip` embed mtimes, ownership,
ordering and a header timestamp, so an identical rebuild yields a different archive hash. Verified
that the deterministic recipe produces a byte-identical archive across runs:
`tar --sort=name --mtime=<fixed> --owner=0 --group=0 --numeric-owner | gzip -n`.

---

## 3. How consumers obtain the data

**Question.** Download the pinned asset, or build it locally?

**Decision. Download by default, with the local build as an explicit separate command. No automatic
fallback.** One script serves Netlify, CI, Playwright and local development.

**Evidence.**

Building on Netlify would make the live site track `ecosystem-registry` HEAD, removing the promotion
gate the issue exists to preserve. That alone settles it for production.

"Limit the local build to the last five releases" does not work: only eight versions exist, so it
saves three versions of a 13-second job, and the builder has cross-version passes
(`main.py:226-277`: `backfill_metadata`, `normalize_config_descriptions`,
`backfill_underdocumented_configs`, `build_global_configurations`,
`count_unique_java_library_names`). A truncated build therefore produces different content, not a
subset of the full build.

An automatic fallback produces a different database, not a degraded copy of the pinned one. One
network blip on a production build would promote unreviewed registry content, and after a fallback
there is nothing left to compare against `archive_sha256`.

**Two wiring constraints, both measured.**

The fetch belongs in the `package.json` scripts, `&&`-chained, **not** in the `netlify.toml` build
block. That block has no `set -e`, and bash returns only the last command's status: a failing
download mid-block leaves exit 0 and the site deploys with missing or stale data. With the fetch
inside the npm script, `netlify.toml` needs no change at all.

The download URL is built as a literal from a hardcoded origin plus the pinned tag and filename,
never resolved through `api.github.com`. Measured: five downloads from
`github.com/<owner>/<repo>/releases/download/...` consumed **0 of 60** of the anonymous budget; one
call to `api.github.com/repos/.../releases/latest` consumed **1 of 60**. Netlify's build IPs are
shared. The fetch path also uses **zero secrets and zero environment variables**, because any secret
flips fork deploy previews to requiring manual approval under Netlify's default policy.

---

## 4. Browser cache invalidation

**Question.** The `DB_VERSION` bump is triggered today by git seeing changed files. That signal
disappears. This one is **not settled**: it is owned by phase 2, which must choose. The
recommendation below is what the evidence supports.

**Alternatives considered.**

- **Keep bumping the integer**, changing only what triggers it (the content digest against the
  committed manifest). Smallest change, no browser-facing code. But it keeps discarding the whole
  database to invalidate the mutable part, and it keeps the defect where two open data pull requests
  both make the identical 28→29 edit, git merges the second silently, and that merge therefore
  invalidates nothing.
- **Split schema version from data version**: `DB_VERSION` becomes schema-only, and each cache entry
  is stamped with the data's content id. Removes both problems, and takes `idb-cache.ts` out of the
  data pull request path entirely. It is the only piece of this work that touches code running in
  users' browsers.

**Recommendation. The split: keep `DB_VERSION` as a schema-only monotonic integer.** Inject the
data's `content_digest` at build time and stamp each cache entry with the value it was written
under; a mismatch is a miss. Apply it only to mutable keys, selected by an explicit
`immutable: true` flag on `fetchWithCache`, never by object store.

**Evidence.**

Deriving the IndexedDB version from a hash is ruled out by the specification: the version is an
unsigned integer, and opening with a lower one throws `VersionError`. A digest is effectively
random, so a lower value eventually appears, and `idb-cache.ts:90-95` latches `dbInitFailed`
permanently — recoverable only by the user clearing site data.

The current design also discards more than it needs to. Of the cache, **91.7% (17.99 MB, 2,018
files) is content-addressed** and cannot go stale; the mutable part is 1.62 MB across 30 files (28
at `HEAD`, because #1155 moved two curated files out of `configuration/`). Every bump discards all
of it to invalidate 8.3%, and 21 of the 31 commits touching `idb-cache.ts` are automated bumps, so a
bump lands about once a week.

A separate limit already caps what any of this preserves, and it changes what "migration cost"
means. `idb-cache.ts:20` sets `CACHE_EXPIRATION_MS` to 24 hours, and `getCached` treats anything
older as a miss unless the caller passes `allowExpired`, which only the network-failure fallbacks in
`fetch-with-cache.ts` do. The content-addressed 91.7% is therefore refetched daily regardless of
`DB_VERSION`, even though a content-addressed path can never serve stale content. That is the
strongest argument for the `immutable: true` flag: the same classification that selects which
entries the stamp applies to is the one that lets those entries skip expiry. Without it, a per-entry
stamp only changes which mechanism discards them.

So the cutover is cheap because of what it does **not** impose, not because of what it preserves:
provided the cutover pull request does not bump `DB_VERSION`, an absent stamp counts as a mismatch
on mutable keys only, so legacy mutable entries refetch once and nothing else changes. A bump would
additionally create a `VersionError` trap on rollback.

Per-entry stamping beats a startup compare-and-clear because it removes the multi-tab race: a stale
tab writing after a deploy stamps its own old id, so a new tab treats those entries as a miss.

**The content id must be a tree hash over `public/data`, not `archive_sha256`**, because
`public/data/defaults/` is curated and will not be inside the archive. That gap already exists
today: the workflow only bumps on bot runs, so a human pull request editing a starter template ships
with no invalidation.

Content-addressed READMEs live in the `METADATA` store next to mutable indexes
(`javaagent-data.ts:214-219`, `collector-data.ts:242-247`), which is why classification must be per
call rather than per store.

---

## 5. Test strategy

**Question.** Fixtures or the real downloaded data?

**Decision. No new fixture corpus.** The seam is inline literals against the pinned archive. Tests
that read the corpus become integration tests; the unit suite stays data-free.

**Evidence.** Every corpus-reading test exists for a reason a frozen snapshot defeats: the normalize
snapshot meets name shapes nobody anticipated, the starter template test catches a curated file
drifting from a **moving** schema, the agent-docs round trip catches a field the corpus grows that
the builder drops. With a frozen input, each of these asserts only what the fixture already
contains.

The cost argument does not rescue fixtures: `test-ecosystem-explorer` needs the data anyway for
`bun run build` and the `dist` tests, so running against real data is free.

Run the database contract **at both ends**: inside the publishing workflow before the upload,
because a broken archive becomes a public release asset the moment it is uploaded, and again on the
promotion pull request, where it is the only run that covers packaging, checksum verification and
extraction.

Scope and acceptance criteria for the first phase are in [`01-test-suite.md`](./01-test-suite.md).

---

## 6. Reviewability

**Question.** The large rebuild diff becomes one file. How does a reviewer still catch data loss?

**Decision.** Corrected per-ecosystem statistics as the human-readable overview, a **name-based
removal check** as the actual gate, a generated change report as the readout, and a committed
inventory as the durable ledger.

**Evidence, and three surprises.**

**The headline number does not move on the failure it is meant to catch.** `ecosystem-stats.json`
counts a union across all versions (`ecosystem_stats.py:25` and `:48`; the docstring says so).
Simulating the loss of 30 components from the latest version only: javaagent 269 → 269, collector
276 → 276. Delta exactly zero, because those components still exist in the seven older versions. The
fix is to count the **latest release per distribution alongside** the union, never instead of it:
`library_count` is consumed by the About page (`about-page.tsx:91`) and changing its meaning would
silently change a published figure from 269 to 259.

**A committed inventory alone does not close it either.** Measured against real history, a normal
release without hashes is `+267 −0`, a clean appended block; with hashes it is `+630 −112`, which
reintroduces exactly the churn being removed. But a broken scraper usually makes the **next**
release short rather than rewriting a published one, and that appears as `+237 −0`: still a clean
append, distinguishable only by counting.

**Count thresholds are structurally insufficient** because they net additions against removals. In
this repository's own history a collector transition had one component removed and one added, net
zero.

So the gate is by name: every component present in release N−1 and absent from N must appear in a
committed `accepted-removals.txt` with a reason. This is Go's `api/except.txt` pattern. Measured on
real history it fires on 7 of 21 (release, distribution) transitions, 19 names in total, median one
name per firing — roughly twice a month, one line each.

**What the inventory does not do.** It would not have caught the `javaagent/announcements.json`
removal in [#882](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/882),
merged 2026-07-30 and restored six weeks later in
[#894](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/894). That class is
closed by directory structure (Phase 0) plus a path-allowlist check on automated pull requests,
which can land today independently of #947.

**What the #882 record shows.** The pull request header reads 1,003 files, the file tree does list
`announcements.json`, and there is no whole-diff truncation banner, so the removal was representable
in the diff. The case for this work is therefore not that such a change is hidden, but that a
surface of 1,003 mostly content-addressed paths gives a reviewer no way to prioritise the one path
that matters. That is the gap the name-based removal check above closes.

---

## Constraints found while designing this work

These are not decisions, but each one changes an implementation choice later, and each is easy to
rediscover the expensive way.

| Constraint                                                                                                                                 | Consequence                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `netlify.toml` sets `base = "ecosystem-explorer"` with no `ignore` command, so Netlify cancels a build when nothing under the base changed | A manifest at the repository root means merging the promotion pull request builds **nothing**, with a green check      |
| An organization-level ruleset makes tags in this repository immutable for automation, with a maintainer bypass                             | Create the release as a **draft** first; GitHub creates no tag until it is published, so a failed upload burns nothing |
| Draft releases are not downloadable anonymously, and Netlify builds previews on the branch-push webhook                                    | Publish the release **before the `git push`**, not merely before opening the pull request                              |
| The otelbot App holds `pull-requests: write` only, with no `contents` scope                                                                | Releases must be created with `GITHUB_TOKEN` under the job's existing `contents: write`                                |
| After untracking, `git add -N <ignored dir>` exits 1 and stages nothing, so the nightly's `has_changes` is permanently false               | The producer rewrite must land **before** the untracking commit, or the nightly silently stops opening pull requests   |
| `.prettierignore` excludes the `public/data` **directory**, which does not match `public/data-manifest.json`                               | The builder must emit prettier-clean JSON or `format-check` fails on every data pull request                           |
| A job summary above 1 MiB is dropped silently and the job still passes                                                                     | Never gate on the presence of the report; gate on the check-run conclusion                                             |
| A required workflow that is skipped by a `paths:` filter leaves its check Pending and blocks merging                                       | The guardrail workflow must not be path-filtered                                                                       |
