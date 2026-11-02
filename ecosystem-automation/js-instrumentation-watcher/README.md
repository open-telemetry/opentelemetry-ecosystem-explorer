# JavaScript Instrumentation Watcher

Automation tool for synchronizing OpenTelemetry JavaScript instrumentation metadata to the ecosystem
registry.

The contrib metadata source is: <https://github.com/open-telemetry/opentelemetry-js-contrib>

## Methodology

On a scheduled basis, the tool clones (or pulls) `opentelemetry-js-contrib`, discovers every
instrumentation package, and records per-package metadata snapshots in the registry.

Process:

- Clone or pull `opentelemetry-js-contrib` (override the checkout with the `JS_CONTRIB_REPO_PATH`
  env var; the clone target dir is configurable with `JS_CONTRIB_REPOS_DIR`, default `tmp_repos`).
- Discover active packages under `packages/instrumentation-*` that ship a `package.json`. Packages
  without a `package.json` (typically deprecated) are skipped.
- Load supporting data once per run:
  - bundle membership from `packages/auto-instrumentations-node/package.json` dependencies, and
  - component owners from `.github/component_owners.yml`.
- Parse each package's `package.json`, `.tav.yml` (tested version ranges), and the "Supported
  Versions" section of its `README.md`.
- For each package, skip it if its current version is already tracked; otherwise write a versioned
  YAML snapshot.

Unlike the Java agent — which has a single release version covering all instrumentations — JS
packages version **independently**. Each package is therefore stored at its own version.

## Registry layout

The watcher maintains a per-package, per-version inventory under `ecosystem-registry/javascript/`:

```text
javascript/
└── {package-name}/                 # e.g. instrumentation-express
    └── v{version}.yaml             # e.g. v0.66.0.yaml
```

This is intentionally different from the aggregated-file ecosystems (Java, .NET, Collector,
Configuration), which write one or more files per release version. Here each package directory holds
one YAML file per version of that package.

### File format

**Example**: `javascript/instrumentation-express/v0.66.0.yaml`

```yaml
component_owners:
  - JamieDanielson
  - pkanal
  - raphael-theriault-swi
description: OpenTelemetry instrumentation for `express` http web application framework
in_auto_instrumentations_node: true
name: instrumentation-express
node_engine: ^18.19.0 || >=20.6.0
npm_package: "@opentelemetry/instrumentation-express"
repository: open-telemetry/opentelemetry-js-contrib
source_path: packages/instrumentation-express
supported_versions: # parsed from the README "Supported Versions" section
  - package: express
    source: README.md
    version_range: ">=4.0.0 <6"
tested_versions: # parsed from .tav.yml
  - mode: latest-minors
    package: express
    range: ">=4.16.2 <6"
    source: .tav.yml
version: 0.66.0
```

Output is deterministic: keys are sorted and the `supported_versions` / `tested_versions` arrays are
sorted by a stable key so upstream reordering does not churn the registry.

## Usage

From the repository root:

```bash
uv run js-instrumentation-watcher
```

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/js-instrumentation-watcher/tests

# Run tests with coverage
uv run pytest ecosystem-automation/js-instrumentation-watcher/tests --cov=js_instrumentation_watcher

# Run the module
uv run python -m js_instrumentation_watcher
```

## Adding Dependencies

```bash
uv add --package js-instrumentation-watcher <package-name>
```

## Browser instrumentation releases

The same command also syncs `open-telemetry/opentelemetry-browser` into
`javascript/browser-instrumentation/v{version}.yaml`. Set `BROWSER_REPO_PATH` to use an existing
checkout, otherwise the watcher clones it alongside js-contrib under `JS_CONTRIB_REPOS_DIR`. Tags
are fetched on every run, including when using an existing checkout.

Only stable `browser-instrumentation-v{version}` tags are considered. All missing tagged versions
are backfilled, existing registry entries are skipped. The manifest and module source are read from
each tag using git blob reads, so unreleased working-tree changes cannot enter a release entry.
Default repository setup pulls `main` before these reads. An explicit `BROWSER_REPO_PATH` skips that
setup pull and preserves the checkout, while still fetching tags. The manifest name and version must
match the release tag.

Each entry contains package metadata and a sorted `modules` list with `name`, `import_path` and
`source_path`. A module must have an `./experimental/` export and a matching `src/{name}/index.ts`
at that tag. `./package.json` is skipped quietly. Any other skipped export is logged, so a module
that leaves `./experimental/` or loses its `index.ts` shows up in the watcher log. An empty
description is left out. Prerelease tags are excluded. Browser metadata has no Node engine, Node
bundle membership or tested target-library ranges, so these fields are omitted.

Each module also includes `scope_name` when its `instrumentation.ts` has a literal string as the
first argument to `super(...)` at the release tag. If the file is missing or the pattern does not
match, a warning is logged and the field is left out. Existing registry entries remain unchanged.
Platform filtering, module search and telemetry are follow-up work under #1187.

A failed browser release is logged and other releases are still attempted, then the command exits
with an error so the scheduled workflow can report the failure.

## Browser SDK releases

The same run tracks `@opentelemetry/browser-sdk` from stable `browser-sdk-v{version}` tags in the
same browser checkout, and writes `javascript/browser-sdk/v{version}.yaml`. Missing versions are
backfilled and existing entries are skipped, the same way as instrumentation releases. The manifest
is read from `packages/sdk/package.json` at each tag, and its name and version must match the tag.
Prerelease tags are excluded.

Each entry sets `package_type: sdk` and has no `modules` list, because SDK exports such as logs and
traces are not instrumentations. A failed SDK release is logged and the command exits with an error,
the same as a failed instrumentation release.
