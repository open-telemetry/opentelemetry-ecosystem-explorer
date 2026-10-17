# Extraction evaluation

This records what the watcher's deterministic extraction can and cannot establish, using the five
cases audited in `EVENT-AUDIT.md`. Every result below was produced by replaying the real upstream
tag with the watcher (`run --source semantic-conventions --tag <tag> --force`) against full clones,
not by hand. The conclusion is the boundary the watcher enforces: it proposes evidence, and only a
maintainer decides.

**Method.** For a release, the baseline is its nearest ancestor release; the model registry
(`groups:` and `definition/2` files) is parsed at both commits into named subjects with their
stability; the changelog section at the tag and its pull request links corroborate. Nothing is
inferred from file movement, and a previous state upstream never stated stays `unknown`. Weaver was
**not** run: it is not installed in this environment. Upstream pins Weaver v0.26.1
(`semantic-conventions/dependencies.Dockerfile`, `semantic-conventions-genai/versions.env`) and uses
`registry diff` for schema tooling; the structured diff here is a small YAML comparison behind the
`take_snapshot` interface, so a pinned Weaver evaluation can replace it later without changing
candidates. Weaver would still not read changelogs or classify milestones.

Classification used below: **(a)** proposed automatically, **(b)** proposed with an explicit review
warning, **(c)** tracked as insufficient evidence, **(d)** excluded from automated classification.
Every candidate still requires review (`requiresReview`); (a) only means the evidence is strong, not
that it is accepted.

| Case                                                | Tag(s) replayed                 | What the watcher produced                                                  | Class                            |
| --------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| 1. HTTP freeze vs later deprecation documentation   | `v1.21.0`, `v1.23.0`, `v1.24.0` | see below                                                                  | (d) freeze, (c) deprecation note |
| 2. Scoped Kubernetes/container stabilization        | `v1.42.0`                       | `k8s`: 42 of 261 subjects release_candidate → stable; `container`: 4 of 34 | (b)                              |
| 3. Messaging reorganization vs new telemetry        | `v1.44.0`                       | no `messaging` candidate; reorganization counted                           | (c)                              |
| 4. Process RC chronology and a later back-reference | `v1.42.0`, `v1.43.0`, `v1.44.0` | transitions in 1.42/1.43, none in 1.44, ambiguity raised                   | (b)                              |
| 5. GenAI move out of core and imported content      | core `v1.42.0`; GenAI range     | move namespaces suppressed; range starts at the reviewed boundary          | (b) / (d)                        |

## 1. HTTP: feature freeze and a later deprecation note

- `v1.21.0` is the first release of the separate core repository, so no ancestor release exists: the
  revision is marked `incomplete` ("No baseline release is an ancestor") and nothing is compared.
  The freeze itself is a documentation status line (`**Status**: [Experimental, Feature-freeze]` in
  `docs/http/http-spans.md`), not a registry value or a changelog word (its entry says only "Add
  transition plan"). It cannot be derived from the model and is **(d)**: a maintainer records it
  from the document.
- `v1.23.0` yields `http: 6 of 23 subjects → stable` with previous state `unknown` (older registry
  files did not state stability for the others). The structured diff undercounts the real
  stabilization; the review warning says the change is scoped, and the changelog entry is attached.
  Useful, **(b)**, never "HTTP is stable".
- `v1.24.0` adds `http.flavor`/`http.user_agent` to the deprecated list (PR #503). The watcher
  produces **no** deprecation candidate, because the subjects were already deprecated, and raises an
  _ambiguity_ quoting the changelog line. This matches the audit: the entry records an earlier
  deprecation and must not become a milestone. **(c)**.

False-positive risk: a deprecation file move that does change state. False-negative risk:
stabilizations whose previous state was never written down.

## 2. Selected Kubernetes/container attributes

`v1.42.0` (baseline `v1.41.0`): `k8s` 42 of 261 subjects `release_candidate → stable` (plus 2
development → release_candidate), `container` 4 of 34 → stable. Every candidate carries "N of M" and
the warning "Scoped change; do not describe the whole namespace". The changelog's "k8s and container
registry attributes" wording is attached as evidence and cannot itself widen the scope. **(b)**: the
scope numbers are reliable; the event title and whether a handful of subjects is timeline-worthy are
editorial.

## 3. Messaging reorganization

`v1.44.0` (baseline `v1.43.0`): the diff adds 65 and removes 23 group/refinement ids (the move to
per-operation `span_refinements`, partly a `definition/2` migration, 24 new subjects in existing
namespaces) but **no subject changes stability and no namespace appears or disappears**, so there is
no `messaging` candidate. The reorganization is reported only as counts ("not proposed as
milestones"). This is the audit's decision to remove `messaging-spans`, reproduced mechanically.
**(c)**. Risk: genuinely new telemetry hidden inside a reorganization is only visible as the "new
subjects in existing namespaces" count.

## 4. Process RC chronology

`v1.42.0`: `process` 34 of 54 development → release_candidate. `v1.43.0`: 13 of 54. `v1.44.0`:
**no** process transition; its changelog entry ("Add process.disk.operations …", whose body says the
namespace "has been made release candidate") is reported as an ambiguity instead of a third
milestone. The structured diff dates each promotion to the release that contains it; the changelog
wording alone would have double-counted. **(b)**; grouping attributes vs metrics vs entity remains
editorial.

## 5. GenAI move and imported content

- In core `v1.42.0` the `gen_ai`, `mcp` and `openai` subjects become deprecated. Their lane's
  migration (`genai-moved`) is already accepted, so those namespaces are suppressed with an `info`
  gap. Provider namespaces that no lane claims (`anthropic`, `aws`, `azure`) still appear as unbound
  deprecations, now with the warning that the revision also moves the genai lane. A deletion or
  deprecation alone cannot say "move"; the changelog line "Move Generative AI semantic conventions
  to a dedicated repository" is kept as evidence.
- The GenAI repository's first 412 commits are rewritten core history. The watcher starts at the
  reviewed commit (`ebe3d1fb…`, the first destination commit), so imported definitions can never be
  proposed as new origins. The range is one coalesced open-ended update, dated by the head commit's
  UTC committer date (`commit-date`), keyed by its start so it keeps one review while it grows, and
  never given a tag. Most commits are attribute-level and yield no candidate; a clean extraction
  still needs an explicit `noMilestone`. **(b)** for core, **(d)** for imported history.

## The boundary

| Automated                                                                  | Always a maintainer decision                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Release discovery, tag → commit, nearest-ancestor baseline                 | Whether a change is a timeline event, and its type                 |
| Per-subject stability transitions with "N of M" and unknown previous state | Title, scope wording, lane, `major`                                |
| Namespaces appearing or disappearing, flagged as move/rename-ambiguous     | Anything documentation-only (statuses, migration notes, freezes)   |
| Changelog and pull request links as corroboration                          | Whether wording that the model does not show describes a milestone |
| Ambiguity and incompleteness reporting                                     | Accepting, excluding, or recording `noMilestone`                   |

## Known limits

- Lanes cover a curated selection: on `v1.44.0`, 73 of 94 namespaces (770 of 1,655 subjects) belong
  to no lane. Their candidates are produced, marked "not bound to any lane" and left for a
  maintainer.
- Lane namespaces are matched to subject name prefixes (`_` and `-` are equivalent). `feature-flags`
  therefore never matches upstream's `feature_flag`.
- The previous state can only be `unknown` where older registries did not state it, so counts are
  lower bounds.
- Changelog wording produces ambiguities, not candidates, and is intentionally noisy.
