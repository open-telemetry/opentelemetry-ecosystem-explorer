# AGENTS.md — ecosystem-automation

Python pipelines that watch upstream OpenTelemetry projects and write versioned metadata into
`ecosystem-registry/`.

- `collector-watcher/` — Collector core/contrib components
- `java-instrumentation-watcher/` — Java agent instrumentations
- `configuration-watcher/` — Declarative configuration schema
- `explorer-db-builder/` — Builds the content-addressed database the frontend reads
- `watcher-common/` — Shared base classes for inventory and version detection
  (`watcher-common/src/watcher_common/`)

Python 3.11+, managed with `uv` (workspace at the repo root). Linter and formatter: Ruff. Tests:
pytest.

## Commands

Run from the repository root:

- `uv sync` — Install workspace dependencies
- `uv run pytest ecosystem-automation/` — Run the test suite
- `uv run pytest ecosystem-automation/<pkg>/tests/test_x.py::test_y` — Run a single test
- `uv run ruff check ecosystem-automation/` — Lint
- `uv run ruff format ecosystem-automation/` — Format
- `uv run collector-watcher` / `uv run java-instrumentation-watcher` /
  `uv run configuration-watcher` / `uv run explorer-db-builder` — Run a watcher

Each watcher exposes a `sync` orchestrator (used by nightly CI). The `collector-watcher` and
`configuration-watcher` also expose a `backfill` mode (`--backfill`) for re-extracting existing
versions after a schema change.

## Watcher contract

Every watcher inherits from the shared base classes in `watcher-common/src/watcher_common/`. Two
non-negotiable rules:

- **Idempotency.** Always check whether a version is already in the inventory before processing it.
  Without this, nightly runs re-process every version and produce noisy diffs.
- **Inventory layout.** Versions are written under
  `ecosystem-registry/{ecosystem}/{distribution}/v{version}/`, using semantic versioning with a
  `SNAPSHOT` prerelease tag for nightly builds.

## Schema discipline

Output written to the registry is consumed by `explorer-db-builder` and the frontend. Old registry
files are committed to Git and immutable. Breaking the schema breaks history.

- **No timestamps in output.** Output must be deterministic so the same input produces the same
  content hash.
- **Stable ordering.** Arrays must be sorted by a stable key. Different ordering busts the
  content-addressed cache.
- **Aggregated YAML per component type per version.** All expected files must be present for a
  version, even if empty. Partial writes leave the registry in an inconsistent state that persists
  in Git history.
- **Schema evolution is versioned, not in place.** When an input format changes, register a new
  version-specific parser instead of mutating existing ones. Adding a required output field requires
  re-extracting all historical versions.

## API clients and rate limits

The Java watcher fetches metadata from GitHub with retry/backoff and timeout configured. In CI it
requires the `GITHUB_TOKEN` env var; locally, set it in your shell to avoid hitting unauthenticated
rate limits during testing. The collector and configuration watchers operate on local Git clones and
have no API limits.

## Testing

Tests must not hit real external APIs (sandboxed CI will fail). Use existing fixtures and mocked
clients. After changing anything in `watcher-common`, run the full suite, not just the watcher you
were editing.

## Footguns

- Skipping the version-existence check causes nightly re-processing and large noisy PRs.
- Manually deleting a version directory shifts the deprecation baseline for the collector watcher
  and produces false-positive deprecations on the next sync. Use the watcher's helpers instead.
- Snapshot cleanup must be paired with writing a replacement, otherwise the snapshot is missing on
  the frontend until the next sync.

## Before finishing

Run before submitting changes:

- `uv run ruff check ecosystem-automation/`
- `uv run ruff format --check ecosystem-automation/`
- `uv run pytest ecosystem-automation/<changed-pkg>/` (or the full suite if `watcher-common/`
  changed)
