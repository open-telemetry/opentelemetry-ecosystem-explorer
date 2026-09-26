---
title: "Roadmap — Python Instrumentation Research"
issue: 135
type: roadmap
phase: "meta"
status: in-progress
last_updated: "2026-09-22"
---

## Phase 1: Metadata Audit (Complete)

- [x] Investigate upstream metadata sources (`pyproject.toml`, `package.py`, `README.md`)
- [x] Document the duplication and reliability of supported library versions
- [x] Analyze the hybrid versioning model used in `opentelemetry-python-contrib`
- [x] Explicitly define the boundary between core Python instrumentation and GenAI instrumentation

## Phase 2: Registry and Schema Design (Complete)

See [`02-schema-design.md`](./02-schema-design.md).

- [x] Design registry schema to support Python's structured metadata
- [x] Account for Python's hybrid release model in the registry layout
- [x] Determine how to handle packages that release lockstep vs independently versioned ones

## Phase 3: Watcher and Automation (In Progress)

Watcher core (repository management, package discovery, metadata parsing, version resolution,
registry generation, disagreement/unresolved-metadata cross-check) is implemented in #1088's PR 1
(currently open as PR #1099). CI/nightly automation is a separate, later PR — see
[`01-metadata-audit.md`](./01-metadata-audit.md) and [`02-schema-design.md`](./02-schema-design.md)
for the design this implements.

- [x] Draft Phase 3 watcher architecture for extracting metadata from `pyproject.toml` and
      `package.py`
- [x] Implement parsing logic for supported versions (`instruments`, `instruments-any`,
      `_instruments`, `_instruments_any`)
- [ ] CI/nightly automation (scheduled runs, failure notification) — deferred to a follow-up PR

## Later Phases (Future)

- [ ] Populate database builder with Python ecosystem data
- [ ] Integrate Python instrumentation into the Explorer frontend

## Open Questions

1. How should the Explorer visually represent Python's hybrid versioning model?
2. Since telemetry metadata (spans/attributes) is thin, what is the minimum viable telemetry
   coverage required to display a package?

These two remain open — both are Explorer/frontend display questions, out of scope for the watcher
implementation in PR #1099.

## Schema-design §7 decisions answered by the PR #1099 watcher implementation

[`02-schema-design.md` §7](./02-schema-design.md#7-open-decisions-for-maintainers) tracked five open
decisions deferred from schema design to the Phase 3 watcher. PR #1099 has now settled two of them
concretely, and found evidence relevant to a third; the rest remain open:

- **§7 #2 — reconciliation policy when `pyproject.toml` and `package.py` disagree: answered.**
  `pyproject.toml` remains authoritative for the registry's `instruments` field. Disagreement is
  logged and reported (`InstrumentationSync`'s `disagreements` summary bucket) but never blocks
  extraction — the audit found no upstream CI enforcement guaranteeing the two sources stay in sync,
  so treating divergence as fatal would block extraction over an already-tolerated upstream
  inconsistency. A field that's absent, unresolvable, or built from a dropped/unparseable
  requirement string is excluded from a confident disagreement result and surfaced separately via an
  `unresolved` summary bucket instead, so it can never silently read as "the sources agree".
- **§7 #5 — release-vs-snapshot extraction: answered — no Python `SNAPSHOT`.** `main`'s `version.py`
  always holds the next unreleased `.dev` version, which never changes across a release cycle;
  extracting from it would make `version_exists()` treat every subsequent nightly run as already
  tracked. Mapping `.dev` to a `SNAPSHOT` suffix (as Java/.NET/collector/configuration do) is not
  viable here: `semantic_version.Version` cannot parse PEP 440 pre-release strings like `"0.65b0"`
  at all (not just the `.dev` case), so a Python snapshot version could be neither constructed nor
  compared with the existing tooling. Instead, the watcher checks out the most recent repo-wide
  release tag before parsing (reusing `BaseRepositoryManager._checkout_version`), so every extracted
  version is already a real, published release string — there is no Python `-SNAPSHOT` extraction,
  and none is planned.
- **§7 #3 — structural lockstep-vs-independent signal: not answered, but informed.** Verified
  against a live clone of `opentelemetry-python-contrib`: as of this PR, every package under
  `instrumentation/` (the watcher's actual scope) resolves to the same release-tag version — the
  packages that currently version independently (`opentelemetry-instrumentation-openai-v2`,
  `opentelemetry-instrumentation-google-genai`, etc.) are tagged `<package>==<version>` rather than
  the repo-wide `v<version>` line, and live under the separate, explicitly out-of-scope
  `instrumentation-genai/` area. This doesn't resolve the original sub-question (whether an
  independently-versioned package can be structurally detected, e.g. via its own `CHANGELOG.md`) —
  it's simply not yet observable in-scope. Not assumed to hold permanently, since the audit
  describes independent versioning as a "growing" subset.
- **§7 #1 — precise `instruments` vs `instruments-any` semantics: still open.** The watcher
  preserves `source_key` per entry (never collapses the two keys) but still doesn't assert what the
  distinction means.
- **§7 #4 — owner/codeowners metadata: still open.** No source implemented; no upstream
  CODEOWNERS-equivalent was found for instrumentation packages.
