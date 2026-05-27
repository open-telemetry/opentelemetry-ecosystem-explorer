---
applyTo: "ecosystem-registry/**"
---

# Registry review rules

`ecosystem-registry/` stores versioned upstream metadata. **Files here are written by automation
only.**

## Bot-authored vs human PRs

- If the PR title starts with `[automated]` or the author is `app/otelbot` or `app/renovate`, the
  diff IS the regenerated output. Do not flag style, schema validity, redundancy, missing tests, or
  documentation. The watchers produced this content.
- If a non-automation PR touches files under `ecosystem-registry/`, that is the suspicious case.
  Flag and request the change come from a watcher run.

## Hand edits

The only acceptable hand-touched changes are:

- Re-extractions performed by running a watcher locally.
- Schema migrations explicitly coordinated with the watcher change in the same PR.

## Immutability

- Old `v{version}/` directories are committed as historical record. Flag deletions of existing
  version directories.
- Flag renames or in-place rewrites of historical files. Schema evolution must add new
  version-specific output, not rewrite past versions.

## Per-version completeness

Each version directory ships a fixed set of files. Flag partial writes:

- **Collector** (`collector/{core,contrib}/v.../`): 5 files — `connector.yaml`, `exporter.yaml`,
  `extension.yaml`, `processor.yaml`, `receiver.yaml`.
- **Configuration** (`configuration/v.../`): 12 schema YAML files
  (`opentelemetry_configuration.yaml`, `tracer_provider.yaml`, etc.).
- **Java javaagent** (`java/javaagent/v.../`): `instrumentation.yaml` plus `library_readmes/`.

## Determinism

All output must be deterministic. Flag diffs that show timestamp churn, reordered arrays, or
whitespace-only changes — these usually indicate a watcher producing non-deterministic output rather
than a real change.
