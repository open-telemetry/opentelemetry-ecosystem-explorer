# OpenTelemetry Ecosystem Explorer: Go Instrumentation Watcher 🔭

A registry-consumer **watcher** for the
[OpenTelemetry Ecosystem Explorer](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer).
It extracts instrumentation metadata and telemetry from Go instrumentation
libraries using static analysis (Go AST) and emits a versioned inventory that
the `explorer-db-builder` consumes.

Currently covers **opentelemetry-go-contrib**, with future support planned for
the **opentelemetry-go** core libraries.

## Canonical Output

The watcher produces a **versioned instrumentation inventory** under the
registry-consumer layout, mirroring the other ecosystem watchers:

```
ecosystem-registry/go/contrib/v{version}/instrumentation.yaml
```

Each inventory is an envelope of fused `Library` records — derived library
metadata combined with telemetry extracted from static analysis:

```yaml
file_format: 0.1
libraries:
  - name: gin
    display_name: Gin
    module:
      path: github.com/gin-gonic/gin
      version: v1.10.0
    instrumentation_type: library
    stability: development
    semantic_conventions:
      - http
    telemetry:
      - # spans/metrics + attributes extracted via Go AST
```

A **Weaver registry** (`registry/signals.yaml` + `attributes.yaml`) is also
generated as an optional dev/validation artifact (`make dev` →
`weaver registry check`), not as the canonical consumer output.

## Core Responsibilities

Per
[watchers-registry-consumers.md#core-responsibilities](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/blob/main/docs/watchers-registry-consumers.md#core-responsibilities),
a watcher must fulfill five critical functions. How this watcher maps to each:

### 1. Version Management
- **Detect releases** — monitor opentelemetry-go-contrib for new release tags
  and trigger extraction. _(planned: tag selection in `tags.go`; today the repo
  is cloned/checked out at `main`)_
- **Generate versioned inventory** — extract per release tag into
  `ecosystem-registry/go/contrib/v{version}/instrumentation.yaml`.
- **Maintain snapshots** — extract from `main` and publish as a patch-bumped
  `-SNAPSHOT` (e.g. `v0.5.3-SNAPSHOT`), replacing the prior snapshot each run
  (`inventory.NextSnapshot`, `Manager.CleanupSnapshots`).

### 2. Schema Evolution
- **Source schema changes** — metadata is derived from each module's own
  `module` directive in the checked-out tag; parsers can be versioned without
  mutating existing ones.
- **Registry schema changes** — the inventory carries an explicit
  `file_format` (Go starts its own lineage at `0.1`, independent of the Java
  watcher's format) so the consumer can map across schema versions.
- **Virtual versioning** — schema version is asserted via `file_format` rather
  than inferred, since the watcher controls the emitted shape.

### 3. Change Detection
- **Schema changes** — inventories are versioned and content-addressable, so
  extractions can be diffed across versions. _(planned: automatic GitHub issue
  creation on field changes)_
- **Data quality** — only modules that resolve as opentelemetry-go-contrib
  instrumentation are emitted; records without a valid module path are skipped.

### 4. Data Regeneration
- **Backfill historical versions** — iterate release tags and generate a
  versioned inventory per tag. _(planned alongside tag checkout)_
- **Regenerate on demand** — `make sync` re-runs the full pipeline; the version
  guard (`Manager.VersionExists`) keeps released versions idempotent while the
  snapshot is always refreshed.

### 5. Deterministic Output
- **Consistent ordering** — inventories are serialized with stable YAML
  encoding and a fixed indent.
- **Reproducible transformations** — no timestamps are written into content;
  content addressing uses a SHA-256 digest truncated to 12 hex characters
  (`inventory.ContentHash`), matching `watcher_common.compute_content_hash`
  across the watcher ecosystem.

## Quick Start

```bash
# Install the weaver CLI (used for the optional dev validation artifact)
make install

# Run the full watcher pipeline → versioned inventory
make sync

# Run the pipeline and validate the Weaver dev registry
make dev
```

## How It Works

1. Clones opentelemetry-go-contrib (and pinned semantic conventions) under `.repo/`
2. Discovers instrumentation packages by walking `go.mod` files
3. For each library, **fuses** derived metadata (from the module directive) with
   telemetry extracted via Go AST static analysis into one `Library` record
4. Writes the versioned inventory under `ecosystem-registry/go/contrib/`
5. Also emits a Weaver registry and validates it with `weaver registry check`

## Commands

```bash
make sync           # Run the full watcher pipeline → versioned inventory
make dev            # Run the pipeline and validate the Weaver dev registry
make build          # Build the watcher binary
make weaver-check   # Validate the Weaver dev registry
make weaver-stats   # Show Weaver registry statistics
make test           # Run tests
make lint           # Run linter (+ weaver check)
make pre-commit     # fmt, tidy, lint, test
```

Tests validate extraction against AWS SDK, Gin, gRPC, MongoDB, and Lambda
instrumentation.

## Roadmap

- [x] opentelemetry-go-contrib instrumentation extraction
- [x] Fused `Library` records (metadata + telemetry)
- [x] Versioned inventory output with `-SNAPSHOT` lifecycle
- [x] Weaver dev registry (signals.yaml + attributes.yaml)
- [ ] Release-tag version management and historical backfill
- [ ] Automated change detection (GitHub issues on schema drift)
- [ ] opentelemetry-go core libraries

## Related Projects

- [OpenTelemetry Ecosystem Explorer](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer) - Registry and consumer pipeline
- [OpenTelemetry Weaver](https://github.com/open-telemetry/weaver) - Schema tooling
- [OpenTelemetry Go Contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) - Instrumentation source

## License

Apache 2.0
