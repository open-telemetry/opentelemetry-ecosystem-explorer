# Python Instrumentation Watcher

Automation tool for synchronizing OpenTelemetry Python instrumentation metadata to the ecosystem
registry.

The metadata source is the contrib repository:
<https://github.com/open-telemetry/opentelemetry-python-contrib>

Background and design rationale for this watcher live in
[`projects/135-python-instrumentation/`](../../projects/135-python-instrumentation/), specifically
the [metadata audit](../../projects/135-python-instrumentation/01-metadata-audit.md) and the
[registry schema design](../../projects/135-python-instrumentation/02-schema-design.md).

## Methodology

On a scheduled basis, the tool clones (or pulls) `opentelemetry-python-contrib`, discovers every
instrumentation package under `instrumentation/`, and records per-package metadata snapshots in the
registry.

Process:

- Clone or pull `opentelemetry-python-contrib` (override the checkout with the
  `PYTHON_CONTRIB_REPO_PATH` env var; the clone target dir is configurable with
  `PYTHON_CONTRIB_REPOS_DIR`, default `tmp_repos`).
- Discover packages under `instrumentation/opentelemetry-instrumentation-*` that ship a
  `pyproject.toml`. The separate `instrumentation-genai/` area is explicitly out of scope (tracked
  instead by [#154](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/154)).
- For each package, parse `pyproject.toml` (authoritative) and `package.py` (cross-check only):
  - `pyproject.toml`'s `[project]` table for name, description, `requires-python`, `urls.Homepage`.
  - `pyproject.toml`'s `[project.optional-dependencies]` `instruments` / `instruments-any` keys for
    instrumented library/version-range pairs (source key preserved per entry).
  - `pyproject.toml`'s `[project.entry-points.opentelemetry_instrumentor]` for auto-instrumentation
    entry points.
  - The package's own version: read directly from `[project].version` if static, otherwise resolved
    from the file named by `[tool.hatch.version].path` (reading `__version__`) when the version is
    `dynamic`.
  - `package.py`'s `_instruments`, `_supports_metrics`, and `_semconv_status`, parsed with
    `ast.literal_eval` rather than executed (`package.py` is untrusted upstream code).
- Compare `package.py`'s `_instruments` against `pyproject.toml`'s `instruments`/`instruments-any`;
  log and report (but do not block on) any disagreement. `pyproject.toml` remains authoritative for
  the `instruments` field written to the registry.
- For each package, skip it if its current version is already tracked; otherwise write a versioned
  YAML snapshot.

Like the JS watcher — and unlike the Java agent, which has a single release version covering all
instrumentations — Python packages are resolved and stored at their own, independent version. This
also holds for packages that happen to release in lockstep with others; see schema design §6 for why
no "release group" field is recorded.

## Registry layout

The watcher maintains a per-package, per-version inventory under `ecosystem-registry/python/`:

```text
python/
└── {package-name}/                 # e.g. opentelemetry-instrumentation-flask
    └── v{version}.yaml             # e.g. v0.48b0.yaml
```

### File format

**Example**: `python/opentelemetry-instrumentation-example/v0.48b0.yaml`

```yaml
description: OpenTelemetry instrumentation for the Example framework
entry_points:
  - name: example
    value: opentelemetry.instrumentation.example:ExampleInstrumentor
homepage: https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-example
instruments:
  - library: example
    source_key: instruments
    version_range: ">=1.0,<3.0"
name: opentelemetry-instrumentation-example
repository: open-telemetry/opentelemetry-python-contrib
requires_python: ">=3.9"
semantic_convention_status: null
source_path: instrumentation/opentelemetry-instrumentation-example
supports_metrics: null
version: 0.48b0
```

Output is deterministic: keys are sorted and the `instruments` / `entry_points` arrays are sorted by
a stable key so upstream reordering does not churn the registry. `version_range` preserves the raw
specifier text from `pyproject.toml`, not a renormalized round-trip.

## Usage

From the repository root:

```bash
uv run python-instrumentation-watcher
```

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/python-instrumentation-watcher/tests

# Run tests with coverage
uv run pytest ecosystem-automation/python-instrumentation-watcher/tests --cov=python_instrumentation_watcher

# Run the module
uv run python -m python_instrumentation_watcher
```

## Adding Dependencies

```bash
uv add --package python-instrumentation-watcher <package-name>
```
