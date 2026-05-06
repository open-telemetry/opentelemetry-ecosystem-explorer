---
applyTo: "ecosystem-automation/**/*.py"
---

# Python watcher review rules

Python 3.11+ in a `uv` workspace. Ruff for lint and format, pytest for tests. Each watcher inherits
from base classes in `ecosystem-automation/watcher-common/src/watcher_common/`.

## Watcher contract

- **Idempotency.** The check is `inventory_manager.version_exists(version)` (defined in
  `watcher-common/src/watcher_common/inventory_manager.py`). Flag any sync path that processes a
  version without first calling it. Flag refactors that remove or short-circuit this check.
- **Mark a version "exists" AFTER all writes succeed**, not before. Marking before sync makes
  transient failures permanently skip backfill on the next run.
- **Inventory layout.** Versions are written under
  `ecosystem-registry/{ecosystem}/{distribution}/v{version}/`. Flag writes that bypass the helpers
  in `BaseInventoryManager.get_version_dir(...)`.
- **Reuse shared helpers.** Content hashing goes through `watcher_common.content_hashing`
  (`compute_content_hash`, `UNKNOWN_HASH`). Flag per-watcher hash reimplementations.

## Schema discipline (registry output)

Old registry files are immutable history. Breaking the schema breaks history.

- **No timestamps in output.** Output must be deterministic so the same input produces the same
  content hash. Flag `datetime.now()`, `time.time()`, or any wallclock value embedded in serialized
  output.
- **Stable ordering.** Arrays in YAML must be sorted by a stable key. Flag iteration over `set()` or
  unordered `dict` whose result is serialized without an explicit `sorted(...)`.
- **Aggregated YAML per component type per version.** All expected files must be written together,
  even if some are empty:
  - Collector versions ship 5 component-type files (connector, exporter, extension, processor,
    receiver).
  - Configuration versions ship 12 schema files.
  - Java javaagent ships `instrumentation.yaml` plus `library_readmes/`.
- **Schema evolution is versioned, not in place.** Flag mutations to existing parsers when an input
  format changes; expect a new version-specific parser and re-extraction of historical versions.

## Conventions

- Every module under `watcher_common/` starts with the Apache 2.0 copyright header (managed by
  `scripts/add_copyright.py`) followed by a module docstring. New modules must follow.
- Type hints on public functions and watcher contract methods.
- Prefer `pathlib.Path` over `os.path`.
- Use explicit exception types. Flag bare `except:` and `except Exception:` without a re-raise or
  logged reason.
- Flag mutable default arguments (`def f(x=[])`).
- Flag direct `requests.get` / `httpx.get` calls in watchers — go through the shared HTTP client in
  `watcher-common` so retry, backoff, and timeout are uniform.

## Tests

- Tests must not hit real external APIs (sandboxed CI fails). Use existing fixtures or mocked
  clients.

## Footguns

- Manually deleting a `v{version}/` directory shifts the deprecation baseline for the collector
  watcher and produces false-positive deprecations on the next sync. Flag tests or scripts that
  `rmtree` registry paths without going through the watcher helpers.
- Snapshot cleanup must be paired with writing a replacement, otherwise the snapshot is missing on
  the frontend until the next sync. Flag cleanup logic that runs without a corresponding write.
