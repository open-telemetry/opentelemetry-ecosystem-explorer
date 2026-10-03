---
title: "Phase 2 — Producer"
issue: 947
type: plan
phase: 2
status: in-progress
last_updated: "2026-10-01"
---

> [!NOTE]
>
> The sequence and the gates live in [`NEXT-STEPS.md`](./NEXT-STEPS.md). The decisions behind this
> phase are in [`design-decisions.md`](./design-decisions.md).

## Phase 2 — Producer

## TL;DR

The builder emits one reproducible `.tar.gz` per ecosystem and the digest that identifies it. The
nightly workflow builds from empty, detects change by that digest, publishes a GitHub Release per
changed ecosystem, then writes `data-manifest.json` and commits it next to the data. The generated
data stays committed: this phase runs the new machinery beside the old one so the next phase can
prove they agree.

## Goal

Produce, on every nightly run, an artifact that a build can fetch instead of reading the checkout,
and a committed manifest that pins exactly which artifact a given commit was built from. Nothing
consumes either yet.

## Scope (in)

- Build from empty and build every ecosystem on every run
  ([`design-decisions.md` §1](./design-decisions.md#1-build-topology-always-from-empty)). The
  `ecosystem` dispatch input stops selecting what is **built** and starts selecting what is
  **promoted**.
- A new builder module that packs each ecosystem directory into a deterministic `.tar.gz` and
  computes its `content_digest`. Exposed behind a new CLI flag. A second module rewrites one
  ecosystem's block in `data-manifest.json`; the workflow calls it after the release publishes,
  because `archive_sha256` must be the published asset's digest, not the bytes this run built.
- Digest-based change detection in the nightly, with git as an independent check on the digest: the
  tree digest before and after the build must agree with what git sees change.
- A contract gate before upload: remove the generated directories, unpack the archives over the
  empty space, assert the tree matches what was just built, then run the integration suite.
- Release publication: draft, upload, publish, all of it before the branch push.
- The manifest committed at `ecosystem-explorer/public/data-manifest.json`, added to the automated
  pull request alongside the data.
- Test coverage in both places the work can fail: the pure computation in
  `db-builder-integration.yml`, the release path by `workflow_dispatch` on a fork.

## Out of scope

- **The `DB_VERSION` split.** It is decided (see below) but ships in its own pull request between
  this phase and phase 3. This phase leaves the `sed` bump step exactly as it is, because while the
  data is still committed that step keeps working.
- The `fetch-database` script and every consumer change. Phase 3.
- `git rm -r --cached` and `.gitignore`. Phase 4.
- Deleting `orphan_gc`, `_is_current`, `remove_orphans` and the builder's `--clean` flag. They
  become unreachable here, but removing them is a follow-up. The workflow's `build_mode` input is
  the exception and goes now: leaving it declared would let a maintainer select "incremental" and
  silently get a clean build.
- The reviewability gate ([`design-decisions.md` §6](./design-decisions.md#6-reviewability)).

## Dependencies

Phase 1, merged on 2026-09-24. The contract gate runs `bun run test:integration`, which only became
a meaningful pre-upload check once the corpus-reading tests moved into that suite and the
missing-data guard existed.

## Decisions taken in this phase

Three, on 2026-09-23. The first closes the open decision that [`NEXT-STEPS.md`](./NEXT-STEPS.md)
assigned to this phase.

### 1. `DB_VERSION` takes the split, in a pull request of its own

The recommendation in [`design-decisions.md` §4](./design-decisions.md#4-browser-cache-invalidation)
is adopted: `DB_VERSION` becomes a schema-only monotonic integer, each cache entry carries the
content id it was written under, and an explicit `immutable: true` flag on `fetchWithCache` selects
the entries that are exempt from both the stamp and the 24-hour expiry.

It lands **between phase 2 and phase 3**, in a pull request that contains nothing else. Two reasons.
It is the only part of #947 that runs in users' browsers, so it deserves a review surface that is
not shared with tar recipes and workflow YAML. And whichever pull request introduces it **must
delete the `sed` bump step in the same change**: if the step survives, the next nightly still
increments the integer, and a subsequent deploy rollback then leaves the browser holding a database
at version _N_ while the code asks for _N−1_. `openDB` throws `VersionError` on the lower value and
`idb-cache.ts` latches `dbInitFailed` permanently, recoverable only by the user clearing site data.

The deadline is phase 4, not this phase: while `public/data/` is tracked, the git-triggered bump
keeps doing its job.

### 2. One release per ecosystem, tagged by content digest, never deleted

The tag is `data-<ecosystem>-<first 12 hex of content_digest>`.

The organization ruleset "Immutable tags with maintainer bypass" applies to every tag in this
repository. Its rules are `deletion`, `non_fast_forward` and `update`, with no `creation` rule, so a
tag can be made but never moved or removed:

```bash
gh api repos/open-telemetry/opentelemetry-ecosystem-explorer/rulesets/5576619 \
  --jq '{target, rules: [.rules[].type]}'
```

That is exactly the shape this scheme needs, and it is awkward for any scheme keyed on time, because
the nightly runs every night and force-pushes to the same branch, so the publish path executes
repeatedly for content that is byte-identical to the previous night's. A date-based tag collides on
the second run of a day; a run-id tag never collides but creates a fresh release every night for
unchanged bytes.

Deriving the tag from the digest makes the scheme idempotent by construction. Unchanged content
yields a tag that already exists, so the run publishes nothing. Changed content yields a different
tag, which cannot collide. Tag immutability stops being an obstacle and becomes the guarantee that
one tag names one content forever. "Is this content already published?" and "do I need a release?"
become the same question.

The tag is not human-readable, so the release **title** carries `<ecosystem> data <date>` and the
body carries the `registry_commit`. Only the tag has to be unique.

**Releases are never deleted.** The committed manifest pins a tag, so deleting a release makes every
commit that pinned it unbuildable: a Netlify rebuild of an older deploy, a reopened preview, a
rollback. Deploy pinning is one of the three reasons #947 exists. Volume is not a concern: 23
automated data updates merged between 2026-02-19 and 2026-09-17, and with digest-derived tags the
nights that change nothing publish nothing.

### 3. Packing in the builder, GitHub calls in the workflow

Everything that is pure computation lives in the Python builder: packing, the tree digest, and the
manifest's shape. Only the calls that need the job's token stay in the workflow, which reads a
release's state, creates the draft, uploads the asset, publishes it and reads the asset's digest
back. There is nothing in those to unit test, and the manifest's `archive_sha256` can only be known
once the asset exists.

The builder is the only option that gets regression coverage for free. `db-builder-integration.yml`
already runs on every pull request touching the builder, `watcher-common`, the registry or
`ecosystem-explorer/src/lib/api/`, and it already performs a clean build; there are 17 pytest
modules to sit beside, and a digest over a tree belongs next to `content_hashing.py`. The workflow,
by contrast, is over 300 lines of YAML-embedded bash that no pull request ever executes.

The objection was that the recipe verified in
[`design-decisions.md` §2](./design-decisions.md#2-archive-granularity-and-manifest-shape) is the
GNU `tar` command line, not Python. It was re-verified: a tree whose files carry deliberately
different mtimes, packed twice a second apart with `tarfile` configured as below, produces the same
sha256 both times. GNU `tar` 1.35 is stable too, and the two produce different bytes from each
other, which does not matter as long as one is chosen and kept. `tarfile` has one advantage the
command line does not: it behaves identically on Linux and macOS, where `tar` is bsdtar.

## The archive

One `.tar.gz` per ecosystem, named `<ecosystem>.tar.gz`, containing the ecosystem directory's files
at paths relative to that directory.

Every field that would otherwise vary is pinned:

- `format=tarfile.GNU_FORMAT`.
- Regular files only, no directory entries, sorted by relative POSIX path in byte order
  (`LC_ALL=C`).
- `arcname` is the path relative to the ecosystem directory, with no `./` prefix.
- `mtime=0`, `uid=0`, `gid=0`, `uname=""`, `gname=""`, `mode=0o644`.
- `gzip.GzipFile(filename="", mtime=0, compresslevel=9)`, so neither a filename nor a timestamp is
  embedded in the gzip header.

## The two digests

They answer different questions and must not be confused. Change detection keys on the first one
only.

**`content_digest`** is computed over the **unpacked** tree, so it knows nothing about tar or gzip.
For every regular file, take the sha256 of its bytes and the path relative to the ecosystem
directory; sort those lines by path in byte order; the digest is the sha256 of
`<sha256 hex>  <relative path>\n` concatenated. That is `sha256sum` output format on purpose, so a
human can reproduce it without running the builder. `.github/scripts/content-digest.sh <directory>`
is that reproduction, and the contract gate calls it rather than the builder, so a bug in the Python
cannot agree with itself.

**`archive_sha256`** covers transport only. It must be the hash of the **published** asset, not of
the bytes this run happened to build: a rerun on a different runner image or zlib version can
produce different bytes for the same content, and phase 3 verifies the download against this field.
GitHub returns it after upload as the asset's `digest`, in the form `sha256:<hex>`, so the workflow
reads it back from the API rather than computing it locally. That check alone is not enough:
`archive_sha256` only records what GitHub served when the block was written, or a value refreshed by
hand after a repair, while `content_digest` is derived from the reviewed build. Phase 3 should
therefore also check the unpacked tree against `content_digest`.

## The manifest

`ecosystem-explorer/public/data-manifest.json`. It sits at the explorer root because `netlify.toml`
sets `base = "ecosystem-explorer"` with no `ignore` command, so a manifest at the repository root
would make the promotion merge build nothing at all, with a green check.

```json
{
  "ecosystems": {
    "collector": {
      "release_tag": "data-collector-3f9a1c4b7e02",
      "asset": "collector.tar.gz",
      "content_digest": "3f9a1c4b7e02...",
      "archive_sha256": "9b21d0f45c88...",
      "registry_commit": "979b9046..."
    },
    "configuration": { "...": "..." },
    "javaagent": { "...": "..." },
    "javascript": { "...": "..." }
  }
}
```

Each ecosystem's block is self-contained and the blocks are physically separated, which is what
makes a stale second merge safe: git resolves the two sides three-way against the common ancestor,
so per-ecosystem promotion merges cleanly and order-independently. A shared top-level block would
have every pull request rewriting the same lines, and a stale merge would silently revert another
ecosystem's data while showing only a changed hex string.

Ecosystems are written in alphabetical order. A run rewrites **only** the blocks whose
`content_digest` changed, so an unchanged ecosystem's lines are untouched and cannot conflict.

`registry_commit` is the checkout SHA of this repository, which is where `ecosystem-registry/`
lives. It therefore pins the builder code as well as the registry data, which is what the
reproducibility claim actually needs: the same commit rebuilt gives the same tree.

`.prettierignore` excludes the `public/data` **directory**, which does not match
`public/data-manifest.json`, so the builder must emit prettier-clean JSON or `format:check` fails on
every data pull request.

## Change detection during the dual run

The data is still committed in this phase, so git is available as an independent observer of the
digest. The builder digests each ecosystem directory twice: once before the build cleans it
(`previous_digest`) and once after (`content_digest`). Both values go into `archive-plan.json`.

- **The tripwire**, `previous_digest` against `content_digest` on one side and `git status` over
  `public/data/<ecosystem>/` on the other, for every ecosystem. Both compare the same two trees, so
  any disagreement in either direction means the digest is wrong, and the run **hard fails**. This
  is the reason the two run side by side before phase 4 removes git as the reference. It holds only
  on the first build after a fresh checkout, where the tree before the build is `HEAD`.
- **The data diff**, the same before-and-after comparison, drives committing the data and the
  `DB_VERSION` bump.
- **The manifest diff**, `content_digest` against the value in the committed manifest, drives which
  releases get published and which manifest blocks get rewritten, and nothing else.

The data diff and the manifest diff answer different questions, so they may legitimately disagree:

- The manifest changed and the data did not: publish and open a manifest-only pull request, **with
  no `DB_VERSION` bump**. This is the normal bootstrap on the first run, and afterwards it is how a
  human pull request that regenerated data without updating the manifest gets corrected.
- The data changed and the manifest did not: the committed tree had drifted from what a build
  produces, for example two data pull requests merged out of order, while the manifest already pins
  the correct output. The data is committed with a `DB_VERSION` bump and nothing is published. The
  contract gate still runs, because the pull request carries the unpacked archives.

Because the two diffs can fire independently, `git add` must name
`ecosystem-explorer/public/data-manifest.json` explicitly: it sits outside `public/data/` and the
existing `git add ecosystem-explorer/public/data/` does not reach it.

## The publish sequence

Order is load-bearing throughout.

1. Build clean, every ecosystem.
2. Emit the archives and, beside them, `archive-plan.json`: each ecosystem's tree digest before and
   after the build, the tag that digest implies, the asset name, and whether it differs from the
   committed manifest.
3. Run the two-way tripwire: git and the tree digest must agree on which ecosystems the build
   changed, or the run stops.
4. Run the contract gate (below). Publication is irreversible, so the gate precedes it.
5. For each ecosystem whose `content_digest` differs from the committed manifest, and only for the
   ecosystems being promoted:
   1. If a **published** release already carries the tag, skip creating it, mark it as a pre-release
      in case it predates that flag, and continue to the digest read and manifest rewrite below: a
      run can publish and then fail before the manifest is written, and this is how that run gets
      corrected.
   2. If a **draft** carries the tag, it is debris from a failed run. Delete it and start over; a
      draft has no tag behind it yet, so deleting one burns nothing.
   3. `gh release create <tag> --draft --prerelease --target <sha> --title "<ecosystem> data <date>"`.
   4. `gh release upload <tag> <ecosystem>.tar.gz`.
   5. `gh release edit <tag> --draft=false`.
   6. Read the asset's `digest` back from the API into `archive_sha256`, now that the release is
      published: a draft has no tag, so `repos/{owner}/{repo}/releases/tags/{tag}` returns 404 for
      one. For a release created in this run, that digest must equal the sha256 pinned right after
      packing, since the bytes are the same. A reused release is checked rather than trusted,
      because the tag is immutable but the asset is not: download the asset, check its sha256
      against that digest, refuse it if it holds anything but regular files, unpack it and require
      the tree to digest to the plan's `content_digest`. It is not compared with this run's archive,
      whose gzip bytes reproduce only on the same runner image. A download or unpack that fails is
      reported as worth a rerun; only a mismatch asks for a repair by hand.
   7. Rewrite that ecosystem's block in the manifest with `data_manifest`.
6. Commit the manifest with the data, push the branch and open or update the pull request.

Each release is created as a **pre-release**. That is what keeps a nightly data drop off the
repository's front page: GitHub picks its Latest release from the non-draft, non-prerelease ones.
`--latest=false` was tried first and does not do this. Measured on a fork: three releases published
with `--latest=false` on both the create and the publish call, and the most recent one still carried
the Latest badge. The flag declines to _promote_ a release over an existing latest; it cannot leave
a repository with no latest release at all. With every release marked as a pre-release,
`GET /releases/latest` returns 404 and no badge appears, while the assets stay downloadable
anonymously.

Publication must complete **before the push**, not merely before the pull request is opened: drafts
are not downloadable anonymously, and Netlify builds previews from the branch-push webhook.

A publication that does not complete **stops the run**. The job fails at the publish step, before
the `DB_VERSION` bump, the commit and the push, so no branch ever carries generated data whose
manifest pins only part of it. That ordering is what makes the guarantee hold: the run's own failure
is not a check on the pull request it has just updated, so a partial publication would leave a pull
request that looks mergeable while the failure sits out of sight. Stopping costs a night and no
more. The build is deterministic from the registry and the tags derive from the content digest, so
the next run re-derives the same tags, reuses any release this one already published through the
state check in step 5.i, deletes any draft left between create and upload through step 5.ii, and
writes the blocks that were missed.

A published asset that was replaced or deleted is the exception. While the committed manifest does
not pin its tag, every run that reaches it fails, and it stays broken until someone repairs it by
hand, because the tag cannot move and releases are never deleted. Once the committed manifest pins
the tag, the nightly no longer looks at that release, so a later replacement surfaces only in phase
3's checks. To repair an asset, rebuild the archives at the commit the tag targets with the
builder's `--emit-archives`, as the nightly does. The replacement must be that output: an archive
made by hand with `tar czf` carries directory entries, which the check rejects. Check with
`.github/scripts/content-digest.sh` that the unpacked archive digests to the `content_digest` the
tag was cut from, and upload it with `gh release upload <tag> <asset> --clobber`. The new bytes can
differ from the old ones, so if `main` already pins that tag, refresh its `archive_sha256` to the
new asset `digest` in a pull request: the nightly rewrites only blocks whose content digest changed,
so it will not.

## The contract gate

[`design-decisions.md` §5](./design-decisions.md#5-test-strategy) requires the database contract to
run at both ends. This is the producer end, and it runs against the bytes about to be uploaded, not
against the build directory:

1. `rm -rf` the generated directories. Unpacking over the existing tree would hide files the archive
   **omits**, which is the failure that matters.
2. Unpack the archives in their place.
3. Assert the tree matches what the builder produced, by recomputing each `content_digest`.
4. `bun run test:integration`.

The nightly job installs Python only, so this adds `setup-bun` and a `bun install` to it.

## Testing before merge

The publish path runs only on upstream, after merge, and a wrong-but-successful publish burns an
immutable tag. Pull request CI never executes it. So it is covered in two places.

**Pure computation, in `db-builder-integration.yml`.** That job already builds clean on every
relevant pull request. Packing the **real** tree twice and comparing sha256 is the determinism check
that matters; the proof above used three short paths, while the real corpus has paths long enough to
take the GNU `LongLink` header path. Plus the `rm -rf` round trip, the `content_digest` against the
shell equivalent above, the prettier-cleanliness of the manifest, and the property that a run
rewrites only the blocks whose digest changed. After its first build it also runs the tripwire, so
the tree digest is checked against git on every such pull request.

**The release path, by `workflow_dispatch` on a fork.** A personal fork carries none of the
organization's rulesets, so its tags are disposable. Run it twice and assert the second run creates
no release and reports the same `content_digest`; download the literal `releases/download/...` URL
anonymously and check the bytes against `archive_sha256`; confirm no release takes the Latest badge.
A fork's manifest is not consumable, because phase 3 builds the URL from a hardcoded origin, and
that is fine: this phase is producer only.

What the fork cannot rehearse is the organization's tag immutability ruleset. The first upstream run
is therefore the first real encounter with it, so a maintainer should dispatch the workflow manually
straight after merge rather than letting the 06:00 cron be the first run, and should watch it: a
publication that does not complete stops the run before the commit, so it withholds the data pull
request as well. On upstream the workflow refuses to run from any branch but `main`, while a fork
may dispatch it from any branch.

## Tasks

| #   | Task                                                    | Deliverable                                                                                                |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Always build clean and build every ecosystem            | The dispatch input selects promotion only; the two build steps collapse                                    |
| 2   | Pack deterministic archives and compute both digests    | Packing the real tree twice yields the same sha256                                                         |
| 3   | Emit and merge `data-manifest.json`                     | Only changed blocks are rewritten; `format:check` passes                                                   |
| 4   | Digest-based change detection plus the two-way tripwire | A digest bug fails the run; a stale manifest opens a manifest-only PR; repaired drift commits data only    |
| 5   | The contract gate before upload                         | `rm -rf`, unpack, digests match, integration suite green                                                   |
| 6   | Publish releases in order                               | Draft, upload, publish, read back the digest, all before the push                                          |
| 7   | Cover the computation in `db-builder-integration.yml`   | Determinism, round trip, digest, digest against git, prettier and block-rewrite all asserted               |
| 8   | Rehearse the release path on a fork                     | Done: three pre-releases, an unchanged rerun that published nothing, bytes verified from the anonymous URL |

## Acceptance criteria

- The nightly builds from empty, every ecosystem, on every run.
- Packing the real tree twice produces byte-identical archives.
- `content_digest` matches the documented shell equivalent for every ecosystem.
- `archive_sha256` is the published asset's digest as GitHub reports it.
- A run whose content is unchanged publishes nothing and rewrites no manifest block.
- Git and the before-and-after tree digest disagreeing, in either direction, fails the run.
- Data that changed under an unchanged manifest is committed with a `DB_VERSION` bump, publishes
  nothing, and still passes the contract gate.
- The contract gate runs against the unpacked archives, not the build directory.
- No release carries the Latest badge, and `GET /releases/latest` finds nothing.
- A publication that does not complete commits nothing, pushes nothing and fails the run.
- `format:check` and `lint:md` pass on the manifest and this document.
- The `sed` bump step is untouched.

## Open questions

None.

## What the fork rehearsal established

The first rehearsal covered the three ecosystems that existed then. `javascript` joined the builder
with #1202, and a second rehearsal, recorded below the first, covered all four.

Run on 2026-09-24 against `lucacavenaghi97/opentelemetry-ecosystem-explorer` at commit `0cee03be`,
by `workflow_dispatch`, with every `gh` call pinned to the running repository:

- The three archives packed, round-tripped and passed the contract gate, and the integration suite
  ran against the unpacked tree.
- The digests matched the values two earlier local builds had produced: collector `367b0a97d371`,
  configuration `ff3eb0ebf3a6`, javaagent `7ece94e509e4`.
- The asset `digest` was available from the API immediately after upload, with no retry needed.
- Downloading `releases/download/<tag>/configuration.tar.gz` anonymously returned exactly the bytes
  whose sha256 the manifest records, which is the check the consumer will perform.
- The data was unchanged, so the run took the manifest-only path: it committed `data-manifest.json`
  and nothing else, left `DB_VERSION` alone, and still opened its pull request.
- **`--latest=false` did not keep the Latest badge away.** That is why the releases are now created
  as pre-releases. This is the one defect the rehearsal found. The fix was then verified the same
  way: the three releases were deleted, the workflow re-ran from scratch, and it created three
  pre-releases with no Latest badge and `GET /releases/latest` returning 404.
- **Publishing really is idempotent.** A third run, dispatched from the automated branch so the
  committed manifest was in the checkout, found all three digests unchanged: it skipped the contract
  gate, skipped publication, skipped the commit and reported no changes, leaving the three existing
  releases untouched. That is the property the digest-derived tag exists to provide, and it is what
  makes a nightly that runs against an open pull request harmless.
- `oven-sh/setup-bun` v2.2.0 rejects the `cache` and `cache-dependency-path` inputs with a warning
  annotation. They were dropped from the step added here. The same two inputs are present in
  `db-builder-integration.yml` and `build-and-test.yml` and produce the same warning there; removing
  them is a small cleanup for another change.

The second rehearsal ran on 2026-10-01 on the same fork at commit `9e425b07`, by `workflow_dispatch`
with ecosystem `all`. The fork had no releases and no manifest yet:

- The two-way check agreed on every ecosystem. Collector and javascript changed for both git and the
  digest: collector because #1139 changed builder output after the committed data was last
  regenerated, javascript because its data was not committed yet, so its previous digest was null.
  Configuration and javaagent were unchanged for both.
- It took the full path: the gate passed and four pre-releases were created,
  `data-collector-95dcbb3e56e0`, `data-configuration-ff3eb0ebf3a6`, `data-javaagent-7ece94e509e4`
  and `data-javascript-55d354255b83`. The configuration and javaagent digests equal the first
  rehearsal's, so the build stayed reproducible across the main merge.
- It committed the regenerated collector data, the new javascript directory, the manifest and a
  `DB_VERSION` bump, and opened its pull request.
- A second run, dispatched from the automated branch, found all four unchanged for both git and the
  digest. It skipped the gate, publication and the commit, and reported no changes.
- The releases were deleted from the fork afterwards.

A personal fork carries none of the organization's rulesets, so it cannot exercise the tag ruleset
at all. That question was answered by reading the ruleset instead: `5576619` is the only ruleset
targeting tags, and its rules are `deletion`, `non_fast_forward` and `update`, with no `creation`
rule, so automation may create `refs/tags/data-*`. What is left untried is the first real execution
against it.

## Follow-ups

- The bootstrap releases and the first manifest are produced by the first upstream run of this
  workflow, which satisfies the phase 4 gate requiring a published, non-draft release.
- A JSON schema for the manifest was not written. The consumer in phase 3 is the first thing that
  parses it, and it is the better place to decide whether the shape needs validating.
- `public/data/` holds hand-maintained directories beside the generated ones, and the set grows:
  `activity/`, `announcements/`, `defaults/` and, since #1138, `semantic-conventions/`. None of them
  is builder output, so they stay tracked and stay outside every archive, and the archiving side
  enumerates the generated directories (`ECOSYSTEMS`) explicitly rather than taking whatever it
  finds. The content id used by the `DB_VERSION` split must hash the whole of `public/data`, not the
  archives.
- The standing credential is gone: the nightly now checks out with `persist-credentials: false` and
  the push mints its own through `gh auth setup-git`. `zizmor --persona auditor` reported
  `artipacked` twice before that change and reports it zero times after.
- That is mitigation rather than isolation, because a process spawned during `uv sync` or the
  contract gate can outlive its step and read a later step's environment. Splitting the build into a
  `contents: read` job that hands archives to a credentialed publish job is tracked as
  [#1162](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1162), with the
  full breakdown of what crosses the boundary.
