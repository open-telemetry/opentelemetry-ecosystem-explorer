---
title: "Registry Schema and Versioning Design — Python Instrumentation"
issue: 135
type: brief
phase: 2
status: complete
last_updated: "2026-09-05"
---

Design proposal for how `opentelemetry-python-contrib` instrumentation packages should be
represented in the `ecosystem-registry/`, as tracked by
[#1064](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1064) (phase 2 of
[#1029](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1029), building on
the phase 1 findings in [`01-metadata-audit.md`](./01-metadata-audit.md)).

**Scope note:** This document is documentation/design only. It does not implement a watcher,
registry files, DB builder changes, CI, or frontend integration. Those are later phases (see
[`NEXT-STEPS.md`](./NEXT-STEPS.md)).

## 1. Problem and context

The metadata audit ([`01-metadata-audit.md`](./01-metadata-audit.md)) established:

- `opentelemetry-python-contrib` exposes structured, machine-readable metadata (`pyproject.toml`,
  `package.py`) rather than relying on README scraping.
- Individual package READMEs do not add metadata the Explorer needs beyond the structured sources.
- Python instrumentation packages follow a **hybrid versioning model**: most release in lockstep
  with the repository's release cadence, but a growing subset version independently. This is neither
  Java's single aggregate version nor JavaScript's fully independent-per-package model.
- The audit recommended a **package-oriented representation** as the natural starting point, while
  explicitly accounting for the hybrid release model.

This document turns those findings into a concrete registry layout, YAML schema, and versioning
model, per the acceptance criteria of #1064.

## 2. Design goals

1. Represent each instrumentation package's metadata from structured upstream sources
   (`pyproject.toml`, `package.py`), never from README scraping as a primary source.
2. Remain correct for both lockstep-released and independently-released packages, without assuming
   that a shared version string implies a coupled release.
3. Follow the repository's existing registry conventions (`docs/registry-structure.md`,
   `ecosystem-automation/AGENTS.md` schema discipline: deterministic output, stable ordering,
   versioned schema evolution) rather than inventing new ones where an existing pattern already
   fits.
4. Only include fields the audit confirmed are sourceable from structured upstream metadata.
   Explicitly flag fields that are missing or unconfirmed rather than inventing a fallback.
5. Be concrete enough that a future watcher implementation (phase 3) knows exactly what data shape
   to produce.

## 3. Proposed registry layout

The audit's central versioning finding — a hybrid of lockstep and independent releases — rules out
the Java/`.NET`/collector/configuration pattern of one aggregated file per repo-wide version,
because there is no single repo-wide version for Python instrumentation. It also means aggregation
can't safely assume "all packages at version X" is a stable release unit, the way Java's javaagent
release is.

This is the same situation JavaScript already solves: `opentelemetry-js-contrib` packages version
independently, so the existing registry stores one file per package version rather than one
aggregated file per repo version (`docs/registry-structure.md#javascript-structure`). Python's
hybrid model is a superset of that requirement — every package still needs its own version stored
independently, whether or not it happens to share a version string with others at a given point in
time. The JS layout is therefore adopted directly:

```text
ecosystem-registry/
└── python/
    └── {package-name}/                # PyPI distribution name, e.g. opentelemetry-instrumentation-flask
        └── v{version}.yaml            # one file per released version of this package
```

`{package-name}` is the PyPI distribution name. Unlike JavaScript's npm packages (which are scoped,
e.g. `@opentelemetry/instrumentation-express`, distinct from the repo-relative short name
`instrumentation-express`), Python instrumentation packages under `python-contrib`'s
`instrumentation/` directory use the full PyPI distribution name as the directory name (e.g.
`instrumentation/opentelemetry-instrumentation-flask/`). One `name` field is therefore sufficient —
there is no need for JS's split between a short directory-derived name and a separate registry
package name.

No `library_readmes/`-style content-addressed directory is proposed, because the audit found
individual package READMEs do not carry unique Explorer-relevant metadata (see
[§9 non-goals](#9-non-goals)).

## 4. Proposed YAML structure

**Illustrative example** (package and values are illustrative, not asserted to be the exact current
upstream state): `python/opentelemetry-instrumentation-example/v0.48b0.yaml`

```yaml
name: opentelemetry-instrumentation-example
version: 0.48b0
description: OpenTelemetry instrumentation for the Example framework
requires_python: ">=3.9"
repository: open-telemetry/opentelemetry-python-contrib
source_path: instrumentation/opentelemetry-instrumentation-example
homepage: https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-example
instruments:
  - library: example
    version_range: ">=1.0,<3.0"
    source_key: instruments
entry_points:
  - name: example
    value: opentelemetry.instrumentation.example:ExampleInstrumentor
semantic_convention_status: null
supports_metrics: null
```

### Field definitions and value requiredness

Every field below is a key that is always structurally present in a package-version file — no key is
ever omitted, matching this repository's existing convention of a stable, diff-friendly shape
(`ecosystem-automation/AGENTS.md`: "all expected files must be present ... even if empty"). The
**Value required** column is a separate axis from that structural presence: it describes whether the
key's _value_ must be concrete and meaningful, or whether the value itself may legitimately be
`null` (scalars) or `[]` (lists) when no reliable value exists. "No" describes the value, never the
key — a "no" field still always appears in the file, just potentially holding `null` or `[]` rather
than data.

| Field                        | Value required     | Meaning                                                                                               |
| :--------------------------- | :----------------- | :---------------------------------------------------------------------------------------------------- |
| `name`                       | yes                | PyPI distribution name; also the `instrumentation/` directory name.                                   |
| `version`                    | yes                | This package's own resolved version for this file (see [§6](#6-versioning-model)).                    |
| `description`                | yes                | One-line package summary.                                                                             |
| `requires_python`            | yes                | Python version support constraint, as a PEP 440-style specifier string.                               |
| `repository`                 | yes                | Constant: `open-telemetry/opentelemetry-python-contrib`.                                              |
| `source_path`                | yes                | Repo-relative path to the package directory.                                                          |
| `homepage`                   | no (may be `null`) | Best-effort URL; `null` if not present in upstream metadata.                                          |
| `instruments`                | yes (`[]` if none) | Instrumented library/version-range entries this package targets.                                      |
| `entry_points`               | yes (`[]` if none) | Auto-instrumentation entry points this package registers.                                             |
| `semantic_convention_status` | no (may be `null`) | Verbatim string mirror of `package.py`'s `_semconv_status`; `null` if the package doesn't define one. |
| `supports_metrics`           | no (may be `null`) | Boolean mirror of `package.py`'s `_supports_metrics`; `null` if the package doesn't define one.       |

Each `instruments` entry:

| Field           | Meaning                                                                                         |
| :-------------- | :---------------------------------------------------------------------------------------------- |
| `library`       | Name of the instrumented third-party library/distribution.                                      |
| `version_range` | Supported version range, stored as the raw specifier string from the source (not renormalized). |
| `source_key`    | Which `pyproject.toml` key this entry came from: `instruments` or `instruments-any`.            |

`source_key` is preserved rather than collapsed, because the audit did not establish the precise
semantic difference between `instruments` and `instruments-any` — see
[open decision #1](#7-open-decisions-for-maintainers). Preserving the raw key avoids asserting a
semantic interpretation the audit didn't confirm.

Each `entry_points` entry is `{name, value}`, mirroring the
`[project.entry-points.opentelemetry_instrumentor]` table in `pyproject.toml` (entry-point name →
dotted class path).

### Fields intentionally not included

- **Owner/codeowners** — the audit found no owner-information source for Python packages ("Owner
  information | None identified in sample | Missing"). Unlike JS's `component_owners` (sourced from
  CODEOWNERS), no equivalent exists here. Not including a field that can't be sourced avoids
  inventing data (see [§9](#9-non-goals)).
- **General package dependencies** — `pyproject.toml` dependencies are structured, but only the
  `instruments`/`instruments-any` subset is Explorer-relevant (which third-party library this
  instrumentation targets); general build/runtime dependencies aren't part of the Explorer's data
  model in any existing ecosystem.
- **Telemetry (spans/metrics) detail**, of the kind Java's registry carries — the audit found Python
  upstream telemetry documentation is thin. Only the coarse `semantic_convention_status` and
  `supports_metrics` signals from `package.py` are included.

## 5. Metadata source-of-truth mapping

| Field                        | Primary source                                                                       | Notes                                                                                                                                                              |
| :--------------------------- | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                       | `pyproject.toml` (`[project.name]`)                                                  | Matches the `instrumentation/` directory name.                                                                                                                     |
| `version`                    | `version.py` / package `__version__` (resolved)                                      | Not read literally off `pyproject.toml`, which may declare the version as dynamic.                                                                                 |
| `description`                | `pyproject.toml` (`[project.description]`)                                           |                                                                                                                                                                    |
| `requires_python`            | `pyproject.toml` (`requires-python`)                                                 |                                                                                                                                                                    |
| `instruments`                | `pyproject.toml` (`[project.optional-dependencies].instruments` / `instruments-any`) | `package.py`'s `_instruments` duplicates this. Treated as a cross-check only, never primary — the audit found no CI enforcement guaranteeing the two stay in sync. |
| `entry_points`               | `pyproject.toml` (`[project.entry-points.opentelemetry_instrumentor]`)               |                                                                                                                                                                    |
| `semantic_convention_status` | `package.py` (`_semconv_status`)                                                     | No `pyproject.toml` equivalent identified.                                                                                                                         |
| `supports_metrics`           | `package.py` (`_supports_metrics`)                                                   | No `pyproject.toml` equivalent identified.                                                                                                                         |
| `source_path`                | Git tree (inferred, not read from a metadata file)                                   |                                                                                                                                                                    |
| `homepage`                   | `pyproject.toml` (`[project.urls]`)                                                  | Exact key name (`Homepage`, `Repository`, etc.) varies by package; best-effort.                                                                                    |
| `repository`                 | Constant                                                                             | `open-telemetry/opentelemetry-python-contrib`, same convention as JS's `repository` field.                                                                         |

**Source not used:** the generated `instrumentation/README.md` and individual package READMEs. The
audit found they aggregate/duplicate the structured sources above without adding Explorer-relevant
data, so no field derives from README parsing.

**When `pyproject.toml` and `package.py` disagree:** `pyproject.toml` is authoritative for
`instruments`, because it's the standard Python packaging-metadata mechanism and the source
`explorer-db-builder`-facing consumers should expect. This is a design-time recommendation; the
concrete reconciliation policy (e.g., whether to log a warning, skip the package, or prefer one
source per field) is deferred to the watcher implementation
([open decision #2](#7-open-decisions-for-maintainers)).

## 6. Versioning model

### Package-oriented, per-package-version files

Each YAML file describes exactly one package at exactly one version. There is no file, field, or
directory that spans multiple packages. This is deliberate: it is the only representation that is
correct regardless of whether a given release happens to be lockstep or independent, because it
never needs to know which case it's in.

- A **lockstep-released** package is represented by writing its own file for its own version,
  exactly like every other package. The fact that other packages were released "at the same time"
  with the same version string is not recorded anywhere — it's simply not a fact this schema needs.
- An **independently-released** package is represented identically: its own file, its own version.
- If a package that has historically shared a version string with others **diverges** in a future
  release, nothing about the schema changes. The next file is just `v{new-version}.yaml` under that
  package's directory, as it always would have been.

### Why there is no "lockstep" / "release group" field

It would be tempting to add a field like `release_group` or `lockstep: true` to make the hybrid
model visible in the data. This is deliberately **not** proposed, because:

- The audit did not identify a reliable, structured upstream signal for "these packages are released
  together by design" versus "these packages coincidentally share a version string right now." Two
  packages can share a version string without being coupled, and the reverse — packages that are
  coupled but whose versions have drifted — is also possible in principle.
- Inventing such a field would encode an assumption the audit doesn't support, which issue #1064
  explicitly warns against: "avoid incorrectly treating a shared version number as proof that
  packages are always released together."
- The package-oriented file layout doesn't need this information to be correct. Grouping (if ever
  wanted for UI purposes) can always be computed later, on demand, by comparing the independently
  stored version strings across packages — it doesn't need to be baked into the source-of-truth
  registry data.

If a reliable structural signal for lockstep-vs-independent is found later (see
[open decision #3](#7-open-decisions-for-maintainers)), it can be added as a new, additive, optional
field without breaking this schema. That is out of scope here.

### Illustration

At one point in time, three packages might look like this (illustrative values):

```text
python/opentelemetry-instrumentation-example-a/v0.48b0.yaml   # version: 0.48b0
python/opentelemetry-instrumentation-example-b/v0.48b0.yaml   # version: 0.48b0 — shares a string with (a); not coupled
python/opentelemetry-instrumentation-example-c/v1.4.2.yaml    # version: 1.4.2  — independently versioned
```

If `example-b` later diverges:

```text
python/opentelemetry-instrumentation-example-b/v0.49b0.yaml   # next release; no schema change required
```

No file for `example-a` or `example-c` needs to change, and nothing in the registry asserts or
denies a relationship between any of these three packages.

## 7. Open decisions for maintainers

1. **Precise `instruments` vs `instruments-any` semantics.** The audit found these keys are
   "consistently encoded but requiring parsing/convention" without fully determining the exact
   distinction (e.g., a single required version set vs. alternative acceptable sets). This schema
   preserves the raw `source_key` so the distinction isn't lost, but the parsing/normalization logic
   is deferred to the watcher implementation, ideally verified against the full 47+ package set
   rather than the audit's 3-package sample.
2. **Reconciliation policy when `pyproject.toml` and `package.py` disagree.** `pyproject.toml` is
   recommended as primary (§5), but the audit found no CI enforcement guaranteeing agreement.
   Whether divergence should be logged, block extraction, or silently prefer one source is a watcher
   implementation decision.
3. **Whether a structural lockstep-vs-independent signal exists.** For example, whether packages
   that version independently maintain their own `CHANGELOG.md` while lockstep packages rely on a
   shared root changelog. This needs verification against the current `python-contrib` repository
   during phase 3; it is not assumed here (§6).
4. **Owner/codeowners metadata.** No source currently exists. Revisit if upstream adds a
   CODEOWNERS-equivalent for instrumentation packages.
5. **Release-vs-snapshot extraction.** This document assumes extraction per published version
   (`v{version}.yaml`), consistent with how the JS watcher operates today. Whether Python should
   also support a nightly `-SNAPSHOT` extraction from `main` (like
   Java/.NET/collector/configuration) is a phase 3 watcher-design question; adding it later would
   not break this schema, since a `SNAPSHOT` suffix is just another version string.

## 8. Implications for the future watcher

A phase 3 watcher implementation should expect to:

- Enumerate instrumentation packages under `opentelemetry-python-contrib`'s `instrumentation/`
  directory (one `pyproject.toml` + `package.py` pair per package).
- Resolve each package's version independently — never assume a single repo-wide version applies to
  all packages.
- Follow the `watcher-common` idempotency contract per package-version, the same way the JS watcher
  does today, rather than per repo-wide release.
- Prefer `pyproject.toml` over `package.py` for `instruments`, per §5, while still reading
  `package.py` for `semantic_convention_status` and `supports_metrics`, which have no
  `pyproject.toml` equivalent.
- Not derive or write any field asserting a relationship between packages based on matching version
  strings (§6).
- Resolve the open decisions in §7 concretely before or during implementation.

## 9. Non-goals

- Watcher implementation, registry generation, or automation (phase 3).
- `explorer-db-builder` or CI integration.
- Frontend/UI integration.
- A telemetry (spans/metrics) schema comparable to Java's — not supported by current upstream
  metadata richness.
- A `library_readmes/`-style content-addressed README store — the audit found individual package
  READMEs add no unique Explorer-relevant data.
- Updating `docs/registry-structure.md`. That file documents ecosystems as currently implemented in
  `ecosystem-registry/`; Python isn't implemented yet. Adding a "Python Structure" section now would
  describe something that doesn't exist on disk. That update belongs with the phase 3 PR that
  actually populates `ecosystem-registry/python/`, at which point it should mirror the
  [JavaScript Structure](../../docs/registry-structure.md#javascript-structure) section and update
  the "Key Principles" note that currently names JavaScript as the sole per-package-version
  exception.
