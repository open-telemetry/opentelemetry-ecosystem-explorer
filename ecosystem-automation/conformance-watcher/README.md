# Conformance Watcher

Automation tool for watching and importing published OpenTelemetry Semantic Conventions Conformance
reports into `ecosystem-registry/`.

## Overview

The OpenTelemetry Semantic Conventions Conformance project publishes aggregate conformance test
results at `docs/data/conformance.json` in
[open-telemetry/semantic-conventions-conformance](https://github.com/open-telemetry/semantic-conventions-conformance).

`conformance-watcher` imports these published aggregates into `ecosystem-registry/conformance/`:

- Consumes upstream reports without running test scenarios or rebuilding reports.
- Stores the latest report in place (`report.json` and `source.yaml`), with Git history recording
  each imported version.
- Enforces content deduplication: if incoming report content matches the committed `report.json`, it
  writes nothing and exits 0.
- Queries the last commit that touched the report file
  (`commits?path=docs/data/conformance.json&per_page=1`) for provenance.
- Preserves full report fidelity (`indent=2`, `sort_keys=True`) for clean, reviewable diffs.
- Atomic writes: writes to temporary files before replacing target files on disk.

## CLI Usage

Run from the repository root:

```bash
# Ingest the latest published report from upstream
uv run conformance-watcher

# Reproducible import / replay of a specific commit SHA
uv run conformance-watcher --revision 6f85d0aa70eb55116d161c5c0737a6ba55faf101

# Validate existing local registry files without network requests
uv run conformance-watcher --validate-only

# Custom output directory (e.g. for testing)
uv run conformance-watcher --output-dir /path/to/custom/registry
```

## Registry Structure

```text
ecosystem-registry/conformance/
├── report.json   # upstream report, indent=2 + sort_keys for reviewable diffs
└── source.yaml   # repository, revision, report_path, upstream schema_version, digest
```

## Testing

```bash
# Run unit tests
uv run pytest ecosystem-automation/conformance-watcher/

# Run linting
uv run ruff check ecosystem-automation/conformance-watcher/
uv run ruff format --check ecosystem-automation/conformance-watcher/
```
