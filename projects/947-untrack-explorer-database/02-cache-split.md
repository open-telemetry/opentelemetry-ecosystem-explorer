---
title: "Split — Schema-only DB_VERSION"
issue: 947
type: plan
phase: 2
status: in-progress
last_updated: "2026-10-06"
---

> [!NOTE]
>
> The sequence and the gates live in [`NEXT-STEPS.md`](./NEXT-STEPS.md). The decision this pull
> request implements is
> [`design-decisions.md` §4](./design-decisions.md#4-browser-cache-invalidation), taken by phase 2
> in [`02-producer.md`](./02-producer.md#1-db_version-takes-the-split-in-a-pull-request-of-its-own).
> It carries `phase: 2` because phase 2 owned the decision; the sequence calls it `split`.

## Split — Schema-only DB_VERSION

## TL;DR

`DB_VERSION` stops being a data version. The browser cache learns which data it was written from by
a content id computed over `public/data` at build time, and each mutable entry records the id it was
written under. Entries whose content can never change are flagged `immutable: true` and skip both
that check and the 24-hour expiry. The workflow's `sed` bump step is deleted in the same change.

## Goal

Take `idb-cache.ts` out of the data pull request path before phase 4 removes the signal the bump
step keys on, and stop discarding the whole browser cache to invalidate the part of it that can go
stale.

## Merge order

This pull request is stacked on phase 2 and is opened only after it. The position between phases 2
and 3 was settled in the decision log (`NEXT-STEPS.md`, 2026-09-23).

1. A maintainer squash-merges
   [#1161](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1161), phase 2.
   Done on 2026-10-05.
2. A maintainer dispatches `build-explorer-database.yml` by hand with `ecosystem: all`, and watches
   it, as [`02-producer.md`](./02-producer.md#testing-before-merge) asks. That run still has the
   bump step. Any fix it needs lands as its own pull request before anything below, so this branch
   rebases once, onto the final workflow. Done on 2026-10-05, with `ecosystem: collector`; it needed
   no fix.
3. A maintainer reviews and **merges**, not closes, the bootstrap pull request that run opens, on
   `otelbot/automated-explorer-database-update-all`: it carries the first `data-manifest.json`,
   which phase 3 and the phase 4 gates need on `main`. Done: that run opened
   [#1236](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1236) on the
   `-collector` branch, merged on 2026-10-05, and the 2026-10-06 nightly completed the manifest
   through [#1214](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1214) on
   the `-all` branch, merged the same day.
4. The author rebases this branch. The repository only squash-merges, so a plain
   `git rebase origin/main` would replay phase 2's own commits. Use
   `git rebase --onto origin/main feat/947-split~N feat/947-split`, where N is the number of this
   branch's own commits: `git rev-list --count feat/947-producer..feat/947-split`, taken before
   phase 2 merges, or 1 if the branch is the single commit it is meant to be. If `idb-cache.ts`
   conflicts on `DB_VERSION`, take `main`'s number. Done on 2026-10-06, by re-applying the change
   onto `main`.
5. The author writes in the three facts only known by then, and opens the pull request from the fork
   against `main`:
   1. The date #1161 merged, in the `NEXT-STEPS.md` Next steps sentence that says phase 2 merged as
      #1161.
   2. The outcome of the first upstream run, that is whether publication passed the tag ruleset and
      whether the run opened the bootstrap pull request, in that same paragraph and in place of the
      `02-producer.md` sentence "What is left untried is the first real execution against it."
   3. Whether the bootstrap release is published. If it is, "Done." is appended to that phase 4 gate
      in `NEXT-STEPS.md`, as the phase 1 gate has it.

   The three facts were written on 2026-10-06.

6. Right before merging, the maintainer who merges resolves each pull request this lists, by merging
   or closing it:

   ```bash
   gh pr list --repo open-telemetry/opentelemetry-ecosystem-explorer --state open \
     --search "head:otelbot/automated-explorer-database-update"
   ```

   The hazard is merging a bot pull request whose head predates this change: its `DB_VERSION` hunk
   still applies cleanly. Closing is not otherwise required, because the nightly force-pushes the
   bot branch from a fresh checkout of `main`.

7. Right after merging, the maintainer who merges, who needs permission to dispatch workflows,
   dispatches the workflow once, so the `-all` bot branch is regenerated without the bump. Until a
   post-split run has done that, do not merge a bot pull request. One whose diff touches
   `idb-cache.ts` is stale by definition.
8. Phase 3 starts from `main`.

## Scope (in)

- **A content id**: the sha256 of the sorted `<file sha256>  <relative path>\n` lines of every
  regular file under `ecosystem-explorer/public/data`. It is defined as the output of
  [`.github/scripts/content-digest.sh`](../../.github/scripts/content-digest.sh) on that directory.
  A Vite plugin computes it once per build or dev server start, in its `config` hook, and exposes it
  as `import.meta.env.DATA_CONTENT_ID` through `define`. On `vite build` it throws when any of
  `public/data/{javaagent,collector,configuration}` lacks its `versions-index.json` or
  `public/data/javascript` lacks its `index.json`, the same check the integration suite's guard
  makes; the dev server only warns. Paths containing a newline, a carriage return or a backslash,
  which `sha256sum` escapes, are rejected rather than hashed differently.
- **Test id.** Both vitest configs define `import.meta.env.DATA_CONTENT_ID` as a fixed test string,
  and an `ImportMetaEnv` augmentation declares it as `readonly DATA_CONTENT_ID: string`.
- **The stamp.** `CacheEntry` gains `contentId`. `setCached` always writes the current id, read at
  call time rather than captured in a module constant, so a test can simulate a deploy between a
  write and a read.
- **The mutable read rule.** `getCached` treats a mutable entry as a miss when it is expired, or
  when it has no `contentId` or a different one, and a missing or empty current id makes every
  mutable lookup a miss. An entry written before this change has no `contentId`, so it misses once
  and is rewritten.
- **The immutable read rule.** An `immutable` option on `getCached` and `fetchWithCache`. An
  immutable lookup ignores `contentId` and expiry, and still refreshes `lastAccessedAt` on a hit, so
  `pruneOldEntries` keeps an entry that is in use.
- **The stale fallbacks keep their meaning.** With `allowExpired`, which `fetchWithCache` uses only
  when the network fails or returns something unusable, an entry is served whatever its age and
  whatever its `contentId`. Serving an older copy is already the policy for expired entries, and a
  stamp mismatch is the same kind of staleness.
- **The four content-addressed JSON call sites** pass `immutable: true`. The classification is
  below. They cache the raw response; anything derived from it is computed after `fetchWithCache`
  returns, as `loadInstrumentation` already does with `_is_custom`.
- **A builder test** that proves the invariant immutability relies on: every JSON file the writers
  put at a hash path parses to an object whose `content_hash` is in its name.
- **`DB_VERSION`**: the line is not touched. No bump.
- **The workflow**: delete the `Increment DB cache schema version` step and the `git add` of
  `idb-cache.ts` in the commit step. The `data_changed` step output loses its only consumer but
  stays: the variable still feeds `any_changed`, the git detector it comes from goes away in phase
  4, and removing the output here would be an adjacent refactor.
- **The documents** listed under [Documents](#documents).

## Out of scope

- Phase 3 and phase 4.
- Making READMEs immutable. It needs a builder change, see [Follow-ups](#follow-ups).
- Recomputing the content id while the dev server runs. The id is taken at startup, so a local
  rebuild of the data needs a restart to invalidate the dev browser's mutable entries.
- Any change to the destructive `upgrade` handler, `pruneOldEntries`, or the object stores.

## Dependencies

Phase 2 ([#1161](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/pull/1161)), for
two reasons: both edit `build-explorer-database.yml`, and the content id is defined as the output of
`.github/scripts/content-digest.sh`, which phase 2 adds.

## Which calls are immutable

A cache key can be flagged immutable only if the parsed data behind it can never change while the
key stays the same. Formatting drift is harmless, because the cache stores parsed JSON. Seventeen
`fetchWithCache` call sites exist; four qualify.

| Call site                                        | Key                                         | Immutable |
| ------------------------------------------------ | ------------------------------------------- | --------- |
| `javaagent-data.ts` instrumentation              | `instrumentation-${hash}`                   | yes       |
| `javaagent-data.ts` version bundle               | `bundle-${version}-${bundleHash}`           | yes       |
| `collector-data.ts` component                    | `collector-component-${hash}`               | yes       |
| `collector-data.ts` version bundle               | `collector-bundle-${version}-${bundleHash}` | yes       |
| `javaagent-data.ts` README                       | `readme-${libraryName}-${markdownHash}`     | **no**    |
| `collector-data.ts` README                       | `collector-readme-${name}-${markdownHash}`  | **no**    |
| every index, versions index, manifest and schema | fixed or version-keyed                      | no        |
| `configuration-data.ts` starter template         | `config-starter-${version}`                 | no        |

The four JSON call sites are keyed by `content_hash` of exactly the object the writer serializes
(`database_writer.py` `write_libraries` and `write_version_bundle`, and the matching methods in
`collector_database_writer.py`), so different data means a different key. Recomputing `content_hash`
over all 1,682 of those files on 2026-10-06 was a one-off check and found no mismatch; the builder
tests now pin the invariant in CI.

**READMEs are not content-addressed.** `markdown_hash` hashes the _upstream_ README, while the file
holds our sanitizer's output. When only the sanitizer changes, the next build writes different
content under the same name. Flagging them immutable would pin a browser to the old sanitized text
for as long as it keeps visiting. They stay mutable: stamped, expiring, and invalidated by the
content id like any index.

This corrects [`design-decisions.md` §4](./design-decisions.md#4-browser-cache-invalidation), which
counted them as content-addressed. Measured on 2026-10-06, the immutable JSON is 1,682 files and
14.6 MB and the READMEs are 647 files and 6.8 MB: 62.7% and 29.0% of `public/data`. Together they
are the hashed files that section measured, and their 91.7% share is the same as on 2026-09-23.

Classification stays per call rather than per store. Today the four immutable call sites are exactly
the `INSTRUMENTATIONS` store, but the README follow-up would put immutable entries in `METADATA`,
and a mutable key added to `INSTRUMENTATIONS` later must not inherit immutability.

## Why the content id covers all of `public/data`

`public/data/defaults/` holds curated starter templates, fetched through the same cache and not part
of any archive, next to other curated directories (`announcements/`, `activity/`,
`semantic-conventions/`). A human pull request that edits a starter template ships with no
invalidation today, because the bump only runs on bot builds. Hashing the whole directory closes
that gap: any change under `public/data`, generated or curated, changes the id of the next build.
`archive_sha256` would miss it, and so would the four per-ecosystem digests in the manifest.

## Why no bump

An absent `contentId` is a miss on a mutable lookup, so legacy mutable entries refetch once and
legacy immutable ones are kept. Their stored shape did not change. A bump would do strictly worse.
It discards the immutable 63% too. And it recreates the rollback trap: a deploy rollback would ask
for a lower version than the browser holds, `openDB` throws `VersionError`, and the cache stays
disabled on every page load until a build with a version at least as high ships.

After this change no workflow bumps `DB_VERSION`. Bump it by hand only when `STORES`, a store's
`keyPath` or the `upgrade` handler change, or when the value cached under an existing immutable key
changes shape; in that last case prefer renaming the key prefix, which invalidates only those
entries. `CACHE_EXPIRATION_MS` is not a reason, because expiry is evaluated at read time.

If a wrong file ever ships at a hash path, the recovery is to change its content, which gives it a
new hash, or failing that a bump.

## Documents

Updated in this pull request. As phase 2 did for phase 1, this pull request records the merge of the
one before it, so the statuses that describe phase 2 as open are flipped here, not in phase 2's own
pull request, which needs no change.

Three facts were only known after the rebase in step 4, so they were written then: the date phase 2
merged, the outcome of its first upstream run, and whether the bootstrap release is published.

- `NEXT-STEPS.md`: the Next steps paragraph (phase 2 merged, the first-run outcome); the `split` row
  in progress; the phase 4 gates, marking the bootstrap release gate done if it is and adding "the
  split is merged and no workflow step edits `idb-cache.ts`"; the two known-defect rows this closes,
  "fixed by the `split` pull request", with the 91.7% corrected to 63%; the README follow-up,
  reconciled with the Hygiene item that already plans to delete `_is_current`; a decision log entry
  for the README classification; the phase 4 gate that every `vite build` runs after the data fetch;
  and the decision section, which now says content-addressed JSON entries, describes the split in
  the past tense with a pointer to this document, and says a rollback `VersionError` lasts until a
  build with a version at least as high ships. Line references into files this pull request changes
  are dropped.
- `01-test-suite.md`: two line references into the vitest configs this pull request changes are
  dropped.
- `_index.md`: a row for this document labelled `split`, phase 2 `complete`, and the sentence that
  says documents are only added for pull requests 3 and 4.
- `02-producer.md`: `status: complete`, and one line under its note saying the bump step it
  describes was removed by the split; and the rollback sentence, which now says the cache stays
  disabled until a build with a version at least as high ships. At rebase time its "What is left
  untried" sentence is replaced by the first run's outcome.
- `design-decisions.md` §4: "`content_digest`" becomes a content id over the whole of `public/data`;
  the 91.7% and 8.3% sentences and the "refetched daily" sentence carry the README correction; the
  per-store paragraph gets the rationale above; stale line references are dropped.
- `.ai/skills/database-build-review/SKILL.md`: a data pull request no longer touches `idb-cache.ts`,
  and one that does is stale.
- `.github/copilot-instructions.md`, `.github/instructions/github-actions.instructions.md`,
  `.github/instructions/typescript-frontend.instructions.md`: `DB_VERSION` is schema-only, never
  auto-bumped, with the bump rule above word for word, and the `sed` gotcha is gone. Copilot reads
  these files, so the pull request description also says why there is no bump.
- `ecosystem-explorer/AGENTS.md`: the cache paragraph that says every entry expires after 24 hours
  and tells the reader to bump the version.
- `ecosystem-explorer/README.md` and `docs/frontend-architecture.md`: the entry format, the content
  id and the immutable flag.
- `docs/content-addressed-storage.md`: the claim that a hash in the filename means no invalidation
  is needed, which is false for READMEs.
- Three builder comments that justify a check by "would bump `DB_VERSION`" (`collector_builder.py`,
  `collector_display_name_audit.py`, `test_collector_builder.py`). The check stays; the reason
  becomes "would change the content id".

Every file whose status or substance changes also gets `last_updated` bumped.

## Tasks

| #   | Task                                        | Deliverable                                                                                                 |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Compute the content id                      | A tested function and Vite plugin, the test id in both vitest configs, and a `dist` test against the script |
| 2   | Stamp and check entries in `idb-cache.ts`   | Mutable entries miss on a different or absent id; immutable lookups ignore id and age and still touch       |
| 3   | Thread `immutable` through `fetchWithCache` | The option reaches the primary lookup; the fallbacks are unchanged                                          |
| 4   | Flag the four call sites                    | Exactly the four JSON call sites pass `immutable: true`                                                     |
| 5   | Prove the writers' invariant                | A builder test fails if any hashed JSON file's name disagrees with its parsed content                       |
| 6   | Delete the bump step                        | No step in the workflow edits or stages `idb-cache.ts`                                                      |
| 7   | Update the documents                        | Every file under [Documents](#documents), and the three post-merge facts after the rebase                   |

## Acceptance criteria

- After `bun run build`, `.github/scripts/content-digest.sh ecosystem-explorer/public/data` prints
  the id embedded in `dist/`. A `*.dist.test.ts` checks it in CI.
- `vite build` fails when a generated directory lacks its versions index, or `javascript` its
  `index.json`.
- A mutable entry written under one id misses under another, and hits under the same id.
- An entry with no `contentId` misses on a mutable lookup and hits on an immutable one.
- An immutable entry older than 24 hours still hits, and a hit more than an hour after the last
  access updates `lastAccessedAt`, so the entry survives `pruneOldEntries`.
- With the network failing, a mutable entry with a different id is served as stale.
- The diff does not touch the `DB_VERSION` line.
- `build-explorer-database.yml` no longer mentions `DB_VERSION` or `idb-cache.ts`.
- `bun run typecheck` and `bun run test` still pass with the four generated directories removed.
- `bun run lint`, `bun run format:check` and `lint:md` pass, and so do the builder's tests.

## Open questions

None.

## Follow-ups

- **Immutable READMEs.** Hash the sanitized README instead of the upstream one, and the markdown
  files become content-addressed like the JSON. Both README call sites could then pass
  `immutable: true`. Recorded in `NEXT-STEPS.md` beside the Hygiene item, since both touch the same
  writers.
- The dev server keeps its startup id. Watching `public/data` and restarting would fix it, and is
  not worth doing until someone is bitten.
- Two open tabs, one on an old build and one on a new one, overwrite each other's stamps, so every
  mutable entry both tabs use refetches on every load while both stay open: the fixed-name and
  version-keyed indexes, manifests and schemas, and every README the tabs open. Wasteful but never
  wrong, since every refetch comes from the live server. It is accepted because it is bounded by
  what the two tabs open and lasts only while both are open.
