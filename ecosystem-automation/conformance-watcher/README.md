# Conformance Watcher

Automation tool for watching and importing published OpenTelemetry Semantic Conventions Conformance reports into `ecosystem-registry/`.

## Overview

The OpenTelemetry Semantic Conventions Conformance project publishes aggregate conformance test results at `docs/data/conformance.json` in [open-telemetry/semantic-conventions-conformance](https://github.com/open-telemetry/semantic-conventions-conformance).

`conformance-watcher` imports these published aggregates into `ecosystem-registry/conformance/`:
- Consumes upstream reports without running test scenarios or rebuilding reports.
- Employs a **content-addressed snapshot inventory model** (`ecosystem-registry/conformance/snapshots/<snapshot-id>/`) alongside `index.yaml` and `current.yaml`.
- Enforces content deduplication: an unrelated upstream commit with identical report content produces zero git diff and no PR.
- Preserves full data fidelity, including unknown declarations (`declared: null`), requirement-level tallies, finding details, and entities.
- Generates repository context links to each scenario target's `conformance.yaml` and `data.json` pinned to the report's source commit.
- Atomic writes: failures cleanly rollback and preserve previous valid registry state.

## CLI Usage

Run from the repository root:

```bash
# Ingest the latest published report from upstream main
uv run conformance-watcher

# Reproducible import / replay of a specific commit SHA
uv run conformance-watcher --revision 6f85d0aa70eb55116d161c5c0737a6ba55faf101

# Validate existing local snapshots without network requests
uv run conformance-watcher --validate-only

# Custom output directory (e.g. for testing)
uv run conformance-watcher --output-dir /path/to/custom/registry
```

## Inventory Contract

```text
ecosystem-registry/conformance/
├── index.yaml           # Snapshot registry tracking all historical imported snapshots
├── current.yaml         # Pointer to active snapshot
└── snapshots/
    └── <snapshot-id>/   # Content-addressed snapshot (12-char SHA-256 prefix of canonical JSON)
        ├── envelope.yaml
        ├── report.json
        └── targets.yaml
```

## Testing

```bash
# Run unit tests
uv run pytest ecosystem-automation/conformance-watcher/

# Run linting
uv run ruff check ecosystem-automation/conformance-watcher/
uv run ruff format --check ecosystem-automation/conformance-watcher/
```
