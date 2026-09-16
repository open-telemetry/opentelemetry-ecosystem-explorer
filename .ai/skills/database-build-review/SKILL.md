---
name: database-build-review
description: Review the PR produced by the Build Explorer Database workflow (.github/workflows/build-explorer-database.yml) and decide whether the generated diff is correct. Use after a nightly or manual explorer-db-builder run when a new registry release lands and the automated "[automated] Update explorer database (<ecosystem>)" PR needs sign-off, when a build produced an unexpectedly large diff, when files were/weren't deleted as expected, or when deciding whether a change needs a corrections overlay.
---

# Database build review

The `Build Explorer Database` workflow runs `explorer-db-builder`, which turns
`ecosystem-registry/` data into the content-addressed database the frontend reads under
`ecosystem-explorer/public/data/<ecosystem>/`. On success it force-pushes to
`otelbot/automated-explorer-database-update-<ecosystem>` and opens/updates a PR titled
`[automated] Update explorer database (<ecosystem>)`.

This skill reviews that PR: confirm the diff matches what the input change should produce, spot
churn that shouldn't be there, and decide whether anything needs a **corrections overlay** rather
than being merged as-is.

The golden question for every build: **"Does the size and shape of this diff match the input
change?"** A one-release bump should mostly add files for the *new* version. When it also rewrites
files for *old* versions, that is either an intended cross-version normalization (fine, but verify)
or a bug/regression (not fine). Most of the work here is telling those apart.

## Mental model: how the builder writes files

Read this first — the review only makes sense against these mechanics.

- **Three pipelines**: `javaagent`, `configuration`, `collector`. `--ecosystem` selects one (default
  `all`). Each writes its own subtree under `ecosystem-explorer/public/data/`.
- **Content addressing.** Each component version is written to `<name>-<hash>.json` where `hash` is
  a 12-char SHA-256 over the component's key-sorted, whitespace-normalized JSON
  (`content_hashing.py`). **The hash is deterministic** — identical content always yields the same
  hash. So a *new* content file means the *content changed*, full stop. There is no "hashing
  non-determinism"; if you suspect it, you're almost certainly looking at a real content change.
- **Manifests.** `versions/<v>-index.json` maps component name → hash for that version. This is the
  source of truth for "which blob does version V use". Diffing these maps between base and PR tells
  you exactly which (component, version) pairs changed, without reading blobs.
  - javaagent keys: `instrumentations`, `custom_instrumentations`; blobs in `instrumentations/<name>/`.
  - collector key: `components`; blobs in `components/<name>/`.
  - configuration is a schema tree (`versions/<v>.json`, `defaults/`), **not** per-component
    content-addressed — the hash-churn analysis below doesn't apply to it; review it by reading the
    schema/defaults diff directly.
- **Incremental is add-only.** In the default (incremental) mode, the writer writes a new blob or
  skips an existing one — **it never deletes blobs that are no longer referenced by any manifest**
  (`database_writer.py` `write_libraries`). So when content changes, the old blob is orphaned but
  stays on disk. This is why a normal PR shows **many additions and zero deletions**.
- **`--clean` is the only thing that deletes.** It `rmtree`s the whole ecosystem directory and
  rebuilds, so orphaned blobs disappear — but every still-referenced blob is rewritten too, making a
  clean PR huge. Use a clean rebuild as a *diagnostic* (see below), not as the normal path.
- **`bundles/<v>-<hash>.json`** (per-version slim list for the catalog view) and **`index.json` /
  `versions-index.json` / `global-configurations.json` / `ecosystem-stats.json`** are regenerated
  every run; expect them to change whenever any component or the version set changes.
- The workflow also bumps `DB_VERSION` in `src/lib/api/idb-cache.ts` whenever data changes (cache
  bust) — that one-line change is expected in every data PR.

## Mental model: why *historical* versions get rewritten

For javaagent, `run_javaagent_builder` (`main.py`) runs several **cross-version** transform steps
before writing. These intentionally rewrite already-published versions based on the *newest*
release, and they are the usual explanation for a big diff:

- `transform_instrumentation_format` — resolves file formats (0.1/0.2/0.6 catalog+refs) to the
  inline shape. A format/parser change rewrites everything.
- `apply_declarative_name_corrections` (`declarative_name_corrections.py`) — rewrites known-bad
  `declarative_name`s and falls back a missing config `name` to `declarative_name`.
- `apply_telemetry_when_corrections` (`telemetry_when_corrections.py` + `.yaml`) — folds
  test-harness `when`-conditions back into `default` and moves signals into their correct gate.
- `backfill_metadata` (`metadata_backfiller.py`) — back-populates metadata across versions.
- `normalize_config_descriptions` — **pins whitelisted shared configs' `description` to the newest
  version's wording across all versions** (`DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES`). When
  upstream rewords a shared config's prose in the new release, this rewrites that description into
  *every* historical version of *every* instrumentation carrying that config.
- `backfill_underdocumented_configs` — injects whitelisted configs
  (`UNDERDOCUMENTED_CONFIG_BACKFILL`) into earlier versions so a newly-*documented*-but-always-*supported*
  config doesn't read as "added".

Consequence: **one upstream reword or one newly-documented shared config can cascade to hundreds of
files** across (every version × every component that carries it). That is the design working as
intended — it suppresses phantom "changed"/"added" rows in the release-comparison UI — but it must
be *verified*, not assumed.

## Review workflow

### 1. Identify the PR and the input change

```bash
# The automated PR for the ecosystem (usually one open at a time):
gh pr list --repo open-telemetry/opentelemetry-ecosystem-explorer \
  --search '[automated] Update explorer database in:title' --state open
gh pr view <PR> --repo open-telemetry/opentelemetry-ecosystem-explorer --json title,body
```

The body records `Build mode` (incremental/clean), `Ecosystem`, and trigger. Note the mode — a
`clean` build is *expected* to be large and to delete orphans; an `incremental` one is not.

Establish what *should* have changed: usually a single new registry release (e.g. a new
`ecosystem-registry/java/javaagent/.../v2.30.0/`). That sets your expectation for the diff.

### 2. Run the churn analyzer

`diff_build_pr.py` does the manual work: fetches the PR head, diffs every `versions/*-index.json`
manifest against the base, and reports new versions, per-component hash churn split into
new-version vs **historical rewrites**, orphaned (unreferenced) blobs, and the **field-level diffs
grouped by identical change** so a cascade shows up as one group covering N files.

`diff_build_pr.py` is bundled alongside this `SKILL.md` (under `.ai/skills/database-build-review/`).
Run it from the repo root:

```bash
python .ai/skills/database-build-review/diff_build_pr.py \
  --repo-root . --ecosystem javaagent --pr <PR>
# base defaults to the open-telemetry remote's main; override with --base <ref>.
# Use --head <ref> instead of --pr if you already have the branch fetched.
```

Read the report top-down:

- **New versions** — expected for a release bump. Their blobs are legitimately new.
- **Historical rewrites** — the number to scrutinize. Zero is ideal for a plain release bump. A
  nonzero count is only OK if it maps to a known cross-version step (step 3).
- **Grouped field-level changes** — each group is one distinct edit and how many (component,
  version) pairs it hit. This is where you see *what* actually changed.
- **Orphaned blobs** — blobs no longer referenced by any manifest. In incremental mode these are
  expected leftovers from rewrites (see step 5), not a bug in themselves.

### 3. Classify each change group

For every group of historical rewrites, decide which bucket it's in:

| Bucket | Looks like | Verdict |
| --- | --- | --- |
| **Legit new release** | Only new-version blobs; no historical rewrites | Merge |
| **Intended normalization cascade** | A shared config `description` reword, a `declarative_name` fix, a when-condition fold, a backfilled config — matching a whitelist in `declarative_name_corrections.py` / `telemetry_when_corrections.yaml` | Merge; spot-check a few against upstream |
| **Correction opportunity** | A cosmetic reword / rename / phantom add-remove that is *not yet* whitelisted, so it churns history noisily | Don't just merge — add/extend a corrections overlay (step 4), rebuild, re-review |
| **Determinism / regression** | Churn with *no* corresponding input or code change; unstable ordering; a format/parser change rewriting everything unexpectedly | Stop — investigate before merging (step 6) |

Confirm a suspected normalization by matching the changed `declarative_name` against the whitelists:

```bash
grep -n "DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES\|UNDERDOCUMENTED_CONFIG_BACKFILL\|DECLARATIVE_NAME_CORRECTIONS" -A12 \
  ecosystem-automation/explorer-db-builder/src/explorer_db_builder/declarative_name_corrections.py
```

If the changed config's `declarative_name` is already in a whitelist, the cascade is expected. If
it *isn't* and the change is cosmetic, it's a correction opportunity.

### 4. Corrections playbook

When a change is metadata-only noise (cosmetic upstream churn that shouldn't read as a real
per-library change), suppress it with the matching overlay rather than merging the noise. All of
these live in `explorer-db-builder` and are covered by tests — add a case and rerun the suite.

| Symptom | Fix location | What to add |
| --- | --- | --- |
| Shared config's `description` reworded upstream, churning every library that uses it | `DESCRIPTION_NORMALIZATION_DECLARATIVE_NAMES` in `declarative_name_corrections.py` | Add the config's `declarative_name` to the frozenset |
| Config newly *documented* upstream but the capability predates it → shows as "added" | `UNDERDOCUMENTED_CONFIG_BACKFILL` in `declarative_name_corrections.py` | Add `declarative_name → version floor` (or `None` = always existed) |
| Bad/renamed `declarative_name`, or a config missing its `name` | `DECLARATIVE_NAME_CORRECTIONS` in `declarative_name_corrections.py` | Add the rewrite mapping |
| Phantom telemetry add/remove from a `when`-condition flip or a test-harness artifact | `telemetry_when_corrections.yaml` (+ `telemetry_when_corrections.py`) | Add a `corrections:`/`ignore_conditions:` entry — use the **`release-telemetry-review`** skill, which drafts this overlay |

Each overlay entry should carry a comment with the upstream PR/commit and a note that it can be
removed once upstream backfills the fix into historical metadata. After editing, rebuild locally
and re-run this review to confirm the churn is gone:

```bash
uv run explorer-db-builder --ecosystem javaagent   # incremental, to your working tree
uv run pytest ecosystem-automation/explorer-db-builder/tests
```

### 5. Deletions and orphans

Incremental builds legitimately produce **zero deletions** — that is not a bug by itself. But every
rewrite orphans the old blob, and orphans accumulate forever across releases. When reviewing:

- Confirm the PR's orphan set (from the analyzer) corresponds to blobs the rewrites *replaced*, not
  to blobs that are still needed. A referenced blob going missing is a real bug.
- If orphan buildup is the concern, the remedies are a `--clean` rebuild (deletes everything
  unreferenced, but rewrites all blobs → huge PR) or a dedicated prune/GC step. Deciding/adding
  pruning is out of scope for a single review — flag it, don't improvise it into a data PR.

To prove a diff is *only* orphan cruft + intended rewrites, compare an incremental build against a
clean one on the same input: a clean rebuild's set of *referenced* hashes should match the
incremental PR's referenced hashes exactly; only the orphan leftovers differ.

### 6. Determinism / regression check

If churn has no input or code explanation, rule out non-determinism before merging:

- Rebuild the same input twice and diff the outputs — they must be byte-identical. Any difference
  points at unstable ordering or a non-deterministic source (timestamps, set iteration). Schema
  discipline forbids timestamps and requires stable array ordering (see
  `ecosystem-automation/AGENTS.md`).
- If a format/parser change (`transform_instrumentation_format`) rewrote everything, confirm that
  was an intended schema evolution (it requires re-extracting historical versions) and not an
  accidental behavior change.

## Reporting

Summarize for the human reviewer: build mode + ecosystem; new versions added; count of historical
rewrites and the distinct change groups behind them (with the upstream cause for each); whether each
group is intended-normalization / correction-opportunity / regression; orphan count and whether it's
expected; and a merge recommendation (merge / merge-after-corrections / investigate). Cite files as
`path:line` and quote the actual field-level diff for each group.

## Notes

- Content addressing means "new file" ≠ "new information" — a reworded sentence in a shared config
  can generate hundreds of new blobs. Always trace churn to the *field* that changed.
- These corrections should get rarer as upstream metadata stabilizes; they're transitional. Prefer
  fixing metadata upstream when feasible, and remove overlay entries once upstream lands the fix.
- This skill lives in the repo under `.ai/skills/` and is surfaced to Claude Code via the
  `.claude/skills` symlink (see `.ai/README.md`). It pairs with the `release-telemetry-review` skill,
  which drafts the `telemetry_when_corrections.yaml` overlay.
