# OpenTelemetry Ecosystem Explorer: Go Instrumentation Watcher 🔭

A watcher for the
[OpenTelemetry Ecosystem Explorer](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer).
It scans the Go instrumentation libraries in **opentelemetry-go-contrib**, derives metadata for each
one, statically analyzes its telemetry, and writes a versioned inventory that `explorer-db-builder`
consumes.

> Scope is currently go-contrib's `instrumentation/` and `bridges/` subtrees. A core
> `opentelemetry-go` branch is scaffolded in `ScanRepo` but not yet wired up.

## Running it

The watcher is a single binary with no required flags — it locates the monorepo root by walking up
for an `ecosystem-registry/` directory and writes there.

```bash
go run ./cmd/watcher          # run the full pipeline
make build                    # build the ./golang-instrumentation-watcher binary
make test                     # go test -race with coverage
make pre-commit               # fmt, tidy, lint, test
```

Flags (rarely needed):

- `-base-dir` — where upstream repos are cloned (the `.repo/` working dir). Defaults to the cwd.
- `-inventory-dir` — where the inventory is written. Defaults to
  `<repo-root>/ecosystem-registry/go/contrib`.

Cloning go-contrib uses SSH (`git@github.com:...`), so you need a working SSH key for GitHub.

## What it produces

One inventory file per version, keyed by go-contrib's **repo-wide release tag**:

```text
ecosystem-registry/go/contrib/v{version}/instrumentation.yaml
```

Each file is an envelope of fused `Library` records — derived metadata plus statically-analyzed
telemetry:

```yaml
file_format: 0.1
libraries:
  - name: instrumentation-github.com-aws-aws-lambda-go-otellambda
    display_name: Lambda
    source_path: instrumentation/github.com/aws/aws-lambda-go/otellambda
    module:
      path: go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-lambda-go/otellambda
      version: v0.69.0
    target_module: github.com/aws/aws-lambda-go
    go_min_version: 1.25.0
    instrumentation_type: wrapper
    installation:
      type: wrapper
    semantic_conventions:
      - FAAS_SPANS
    stability: experimental
    telemetry:
      - when: default
        spans:
          - kind: server
            attributes:
              - name: faas.invocation_id
                type: string
```

`name` is the repo-relative module path with slashes replaced by hyphens, so modules that share a
leaf directory (e.g. the v1 and v2 `otelmongo` drivers) stay distinct. `display_name` keeps the
short, human-facing form.

## Pipeline

`cmd/watcher` runs two extractions per invocation (see `run` in `cmd/watcher/main.go`):

1. **Latest release.** `repo.LatestReleaseTag` lists go-contrib's remote tags over `git` (no GitHub
   API, so no token or rate limit) and picks the highest bare, non-prerelease semver. If that
   version is already inventoried it is skipped (idempotency); otherwise it is checked out and
   extracted.
2. **`main` snapshot.** `main` is extracted and published as the next patch-bumped `-SNAPSHOT` (e.g.
   `v1.44.0` → `v1.44.1-SNAPSHOT`). The prior snapshot is removed first so only one ever exists.

Each extraction (`syncVersion`) checks out the ref, calls `instrumentation.ScanRepo`, backfills
per-module versions from the git tags pointing at that commit, then writes the inventory.

`ScanRepo` walks the `instrumentation/` and `bridges/` subtrees for `go.mod` files (skipping
`example`, `internal`, and `test` dirs), keeps only modules under `go.opentelemetry.io/contrib/`,
and for each one **fuses** derived metadata with telemetry from Go AST analysis into a single
`Library`. Exporters, propagators, samplers, and detectors are out of scope: they configure the SDK
pipeline rather than instrument a target library.

## Package layout

| Package           | Responsibility                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `cmd/watcher`     | Entry point; orchestrates the release + snapshot extractions                                   |
| `repo`            | Clone/checkout go-contrib at a ref, list tags, download the pinned semconv model               |
| `instrumentation` | Walk modules, parse `go.mod`, derive metadata, run Go AST telemetry analysis, fuse `Library`   |
| `metadata`        | Shared `Metadata` struct and its enums (`InstrType`, `InstallType`, `Stability`)               |
| `inventory`       | Versioned inventory manager (save/load/list/cleanup), snapshot versioning, content-hash helper |
| `conf`            | Environment loading and structured logging                                                     |

## Things to know

- **Dual versioning.** The directory uses go-contrib's bare repo-wide tag (`v1.44.0`); each
  library's `module.version` comes from its own per-module tag at that commit (`v0.x`). The two
  version lines are independent — don't conflate them.
- **Metadata is derived, not authored.** Fields come from each module's own `module`/`go` directives
  plus path heuristics (`instrumentation_type`, `target_module`, `display_name`). Prose fields
  (`description`, installation prose) are left empty.
- **Telemetry analysis is heuristic.** The analyzer infers span kinds, attributes, and metrics from
  AST patterns and supplements them with semantic-convention tables keyed on package type. It is
  best-effort, not a guarantee of runtime behavior.
- **Output must stay deterministic.** Libraries and telemetry are sorted by stable keys and no
  timestamps are written, so re-running produces byte-identical output. `inventory.ContentHash`
  mirrors `watcher_common.compute_content_hash` for cross-watcher parity.

## Related

- [Watcher contract](../AGENTS.md) — shared rules for all ecosystem watchers
- [opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) —
  instrumentation source

## License

Apache 2.0
