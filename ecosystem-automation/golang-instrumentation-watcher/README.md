# OpenTelemetry Ecosystem Explorer: Go Instrumentation Watcher 🔭

A watcher for the
[OpenTelemetry Ecosystem Explorer](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer).
It scans upstream instrumentation repositories (like **opentelemetry-go-contrib** and
**opentelemetry-go-compile-instrumentation**), derives metadata for each instrumentation library,
and writes a versioned inventory that `explorer-db-builder` consumes.

Scope includes `instrumentation/` and `bridges/` subtrees — the components that instrument a
developer's code. Exporters, propagators, samplers, and detectors configure the SDK pipeline and are
out of scope.

## Running it

No required flags: the watcher finds the monorepo root by walking up for an `ecosystem-registry/`
directory and writes there.

```bash
go run ./cmd/watcher   # run the pipeline
make build             # build the ./golang-instrumentation-watcher binary
make test              # go test -race with coverage
make pre-commit        # fmt, tidy, lint, test
```

Optional flags: `-targets` (path to the YAML targets config; defaults to `targets.yaml`) and
`-base-dir` (where upstream repos are cloned, the `.repo/` working dir; defaults to the cwd).
Cloning uses HTTPS over the public repos, so no SSH key or token is needed.

## What it produces

One inventory file per version, keyed by the repository's release tag:

```text
ecosystem-registry/go/{repo}/v{version}/instrumentation.yaml
```

Each file is an envelope of `Library` records:

```yaml
file_format: 0.1
libraries:
  - name: instrumentation-github.com-aws-aws-lambda-go-otellambda
    display_name: Lambda
    source_path: instrumentation/github.com/aws/aws-lambda-go/otellambda
    scope:
      name: go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-lambda-go/otellambda
    modules:
      - path: go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-lambda-go/otellambda
        version: v0.69.0
    target_module: github.com/aws/aws-lambda-go
    go_min_version: 1.25.0
    library_link: https://pkg.go.dev/go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-lambda-go/otellambda
    instrumentation_type: wrapper
    installation:
      methods:
        - wrapper
    stability: experimental
```

`name` is the repo-relative module path with slashes replaced by hyphens, so modules that share a
leaf directory (e.g. the v1 and v2 `otelmongo` drivers) stay distinct; `display_name` keeps the
short, human-facing form. Per-record telemetry (spans and metrics) is added by the Transform step on
a follow-up branch; the schema reserves a `telemetry` field for it.

## Pipeline

`cmd/watcher` runs two extractions per invocation:

1. **Latest release.** `repo.LatestReleaseTag` lists the remote tags over `git` (no GitHub API, so
   no token or rate limit) and picks the highest bare, non-prerelease semver. An already-inventoried
   version is skipped; otherwise it is checked out and extracted.
2. **`main` snapshot.** `main` is published as the next patch-bumped `-SNAPSHOT` (e.g. `v1.44.0` →
   `v1.44.1-SNAPSHOT`), replacing the prior snapshot so only one exists.

Each extraction checks out the ref, runs the appropriate scanner (`instrumentation.ScanRepo` or
`instrumentation.ScanMetadataRepo`), backfills per-module versions from the git tags at that commit,
and writes the inventory. `ScanRepo` walks the two subtrees for `go.mod` files (skipping `example`,
`internal`, and `test`), keeps modules under `go.opentelemetry.io/contrib/`, and derives each
`Library` from its `module`/`go` directives plus path heuristics (`instrumentation_type`,
`target_module`, `display_name`). `ScanMetadataRepo` instead walks the repository for
`metadata.yaml` files and parses them directly.

## Package layout

| Package           | Responsibility                                                                   |
| ----------------- | -------------------------------------------------------------------------------- |
| `cmd/watcher`     | Entry point; orchestrates the release + snapshot extractions                     |
| `repo`            | Clone/checkout upstream repos at a ref, list tags                                |
| `instrumentation` | Walk modules, parse `go.mod`, derive metadata, build `Library` records           |
| `metadata`        | Shared `Metadata` struct and its enums (`InstrType`, `InstallType`, `Stability`) |
| `inventory`       | Versioned inventory manager (save/load/list/cleanup), snapshot versioning        |
| `conf`            | Environment loading and structured logging                                       |

## Things to know

- **Dual versioning.** Repositories like go-contrib use a bare repo-wide tag (`v1.44.0`), while each
  library's `modules[].version` comes from its own per-module tags at that commit (`v0.x`). The two
  lines are independent.
- **Metadata extraction.** Depending on the repository's parsing strategy, metadata is either
  derived from module directives and path heuristics (e.g. `go-contrib`, where prose fields are left
  empty), or it is manually authored and read directly from a `metadata.yaml` file (e.g.
  `go-compile-instrumentation`).
- **Output is deterministic.** Records are sorted by stable keys and no timestamps are written, so
  re-running produces byte-identical output.

## Related

- [Watcher contract](../AGENTS.md) — shared rules for all ecosystem watchers
- [opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) —
  instrumentation source

## License

Apache 2.0
