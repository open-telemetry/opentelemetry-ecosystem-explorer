# semconv-timeline-watcher

Keeps the
[semantic-convention timeline](../../ecosystem-explorer/public/data/semantic-conventions/README.md)
current without deciding what belongs on it. It discovers new upstream history, extracts evidence,
and asks maintainers to review it. Nothing it produces is accepted history.

```text
timeline.json (accepted, hand-curated)  ──►  reviewedThrough
        │
        ▼
discover ──► immutable revisions ──► extract ──► candidates + processing state ──► review issue
                                                                                     │
          maintainer records dispositions and edits timeline.json  ◄─────────────────┘
```

## Three kinds of data

| Data                                                            | Where                                                               | Who writes it                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Accepted history, including the coverage mark `reviewedThrough` | `ecosystem-explorer/public/data/semantic-conventions/timeline.json` | maintainers only; the watcher only reads it |
| Candidates and processing state                                 | `ecosystem-registry/semantic-conventions/<source>/`                 | the watcher; maintainers edit dispositions  |
| Review issues                                                   | GitHub, labelled `semantic-convention-timeline`                     | the watcher, identified by a hidden key     |

Candidates never go under `public/`, so nothing unreviewed is published or reaches agent output.

**`reviewedThrough` is not the processing cursor.** `reviewedThrough` says how far accepted history
is known to cover a source. The `cursor` in `state.json` is the last revision of the contiguous run
of _completed_ revisions. Discovering, extracting or closing an issue moves neither; only recorded
dispositions complete a revision, and only a maintainer's change to `timeline.json` moves
`reviewedThrough`.

## Sources

| Source                       | Mode     | Revisions                                                                                                                                                                                               | Baseline                                                                                                          |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `semantic-conventions`       | releases | every published, non-draft, non-prerelease GitHub release not already in `timeline.json`; the tag is resolved to a commit in a full clone                                                               | the nearest _ancestor_ release (not the previous version number: patch `v1.41.1` is not an ancestor of `v1.42.0`) |
| `semantic-conventions-genai` | commits  | one coalesced, open-ended range from the cursor (or `reviewedThrough`) to the resolved head of `origin/main`; no tags are invented and the date is the head commit's UTC committer date (`commit-date`) | the start of the range                                                                                            |

Because a range starts at the reviewed boundary, definitions imported from core before the move are
never proposed as new origins. Namespaces of a lane whose migration is already accepted are not
proposed again from the old repository.

## What extraction can and cannot tell

Evidence is a structured diff of the `model/` registry (both `groups:` and `definition/2` files)
between baseline and revision, with the changelog and PR links as corroboration. A candidate is
proposed only for:

- subjects moving into `release_candidate`/`stable` (`stability`), reported as "N of M", with the
  previous state `unknown` when upstream never stated one;
- subjects becoming `deprecated` (`deprecation`; it may only record an earlier decision);
- a namespace that appears (`domain`) or disappears (`removed`; removal, rename and move cannot be
  told apart).

Never proposed: new subjects in existing namespaces, renamed or reorganised groups,
requirement-level or documentation-only changes. Changelog wording alone never creates a candidate;
wording that the structured diff does not support is listed as an _ambiguity_ (for example a later
changelog that refers back to an earlier promotion). Unparsed files, a missing changelog section or
a missing baseline mark the revision `incomplete` (status `partial`): it is never reported as "no
change". Every candidate sets `requiresReview`. [EXTRACTION-EVALUATION.md](EXTRACTION-EVALUATION.md)
records the audited cases and the automation/manual boundary. Weaver is not used; a pinned
evaluation can be added behind the same snapshot interface if it proves worthwhile.

## Commands

```sh
uv run semconv-timeline-watcher run                       # both sources, as the nightly workflow does
uv run semconv-timeline-watcher run --source semantic-conventions --tag v1.45.0 --force
uv run semconv-timeline-watcher run --source semantic-conventions-genai --from <sha> --to <sha>
uv run semconv-timeline-watcher check                     # validate dispositions against timeline.json
GITHUB_REPOSITORY=owner/repo uv run semconv-timeline-watcher review   # create/update issues
```

`run` needs `GITHUB_TOKEN` for the release list. A failing source keeps its previous state and does
not stop the other; the exit code is non-zero if any failed. Clones live in `tmp_repos/` (override
with `SEMCONV_REPO_PATH` / `SEMCONV_GENAI_REPO_PATH`).

## Review and disposition

Each pending or partial revision has one issue, found by the hidden marker
`<!-- semconv-timeline-review: <key> -->` (`semantic-conventions@v1.45.0`, or
`semantic-conventions-genai@<12-char start>..` for the open-ended range), so reruns and overlapping
workflows update it rather than duplicate it. A closed issue whose review is incomplete is reopened.

To finish a review, edit the candidate file named in the issue:

```json
{"disposition": {"status": "accepted", "eventId": "<id in timeline.json>"}}
{"disposition": {"status": "excluded", "reason": "<why>"}}
{"noMilestone": {"reason": "<what was reviewed>"}}
```

A revision is **complete** only when every candidate is accepted (the event must exist in
`timeline.json`) or excluded with a reason, or `noMilestone` is recorded with a reason. A range with
no candidates still needs `noMilestone`, because a clean extraction is not a reviewed result. To
advance coverage, move `reviewedThrough` in `timeline.json` in the same change.

## Replay, recovery and changed tags

- Unchanged inputs rewrite identical bytes: files are sorted, carry no timestamps, and unchanged
  revisions are skipped. `--force` re-extracts but keeps dispositions (matched by candidate id).
- Writes are staged and moved into place; `state.json` is written last. An interrupted run leaves
  the previous valid files, `*.tmp` leftovers are removed on the next run, and a state entry whose
  record is missing shows as `failed` and is recreated.
- If a published tag resolves to a different commit, the revision is flagged `tagChanged` and not
  re-extracted until a maintainer replays it with `--tag ... --force`. This holds for revisions that
  were already completed too: a review issue is raised and `check` fails until it is reconciled. An
  _accepted_ release whose tag moved is listed under `reconcile`, gets its own issue and fails
  `check`. Accepted history is never rewritten. A replay at a new commit keeps a disposition only
  for a candidate whose evidence is unchanged and never keeps `noMilestone`; what was reset is shown
  in the review.
- A GenAI range that grows while still unreviewed keeps its key. New commits are never covered by an
  earlier `noMilestone`: once a range is complete, the next range starts at the later of its end and
  `reviewedThrough`. A manual `--from/--to` replay is reviewed like any range but never moves that
  start.
- If upstream rewrites the GenAI history so the start is no longer an ancestor, the source fails.

## Failures and malformed files

- A revision that cannot be extracted (a published tag missing from the clone, a git error) is
  recorded as `failed` and gets a review issue under the same key a success would use, so a later
  successful run updates that issue. The other revisions are still saved. The workflow then fails
  its `check` step, which notifies maintainers.
- Candidate files and `state.json` are shape-checked on every read. A malformed candidate file fails
  only its own revision and is never overwritten; a malformed `state.json` fails only its source.
  The other source keeps running, and `check` lists every defect.
- Review issues neutralise `@mentions` in upstream or hand-edited text and are truncated below
  GitHub's body limit. For a lane that moved between sources, the review shows the destination's
  monitoring status and the interval that is still uncovered.

## Workflow

`.github/workflows/nightly-semconv-timeline.yml` runs nightly and on manual dispatch, one job chain
per source (candidate PR through `reusable-registry-sync.yml`, then review issues, with failures
reported through `reusable-workflow-notification.yml`). Merging the candidate PR accepts nothing.
Manual `tag`, `from`, `to` and `force` inputs require choosing one source and are validated by the
watcher; dispatching requires write access.

Trust boundary: the review job runs only code from the default branch. The automation branch is
checked out into a separate `automation-data/` directory and read as JSON; nothing from it is
installed or executed. The job's token can write issues and read contents and pull requests, nothing
more.
