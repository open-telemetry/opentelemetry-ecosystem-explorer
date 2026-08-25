# Instrumentation

This package scans upstream instrumentation repositories (like
[opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) and
[opentelemetry-go-compile-instrumentation](https://github.com/open-telemetry/opentelemetry-go-compile-instrumentation))
and produces a metadata descriptor for each instrumentation module it finds. The watcher
(`cmd/watcher`) drives the scan with `ScanRepo` (for go-contrib, parsing `go.mod` files) or
`ScanMetadataRepo` (for pre-authored `metadata.yaml` files) and writes the results into the
versioned inventory under `ecosystem-registry/go/{repo}`.

Each subdirectory (for example `otelhttp/`) is a self-contained, runnable Go module that
demonstrates one or more contrib libraries end-to-end. These exemplars exist for manual inspection —
they are not inputs to the watcher. See `otelhttp/doc.go` for what an exemplar does.

## How fields are derived (go-contrib)

For repositories using `ScanRepo` (like go-contrib), `DeriveMetadata` (`metadata.go`) infers each
descriptor field from a module's go-contrib path, version, and declared Go version. `displayNameMap`
and the bridge lookup tables live in `parser.go` and `metadata.go`. For repositories using
`ScanMetadataRepo` (like go-compile-instrumentation), fields are read directly from the authored
`metadata.yaml`.

| Metadata field         | Derived from                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | Module path suffix after `go.opentelemetry.io/contrib/`, with `/` replaced by `-` (globally unique)                                                              |
| `display_name`         | `displayNameMap` / bridge tables, keyed on the path leaf minus the `otel` prefix                                                                                 |
| `modules[].path`       | The module path                                                                                                                                                  |
| `modules[].version`    | The resolved module version                                                                                                                                      |
| `go_min_version`       | `go` directive in the module's `go.mod`                                                                                                                          |
| `otelc_min_version`    | Minimum compile-time instrumentation tool (otelc) version required (not inferred for go-contrib)                                                                 |
| `scope.name`           | Same as `modules[0].path`                                                                                                                                        |
| `library_link`         | `https://pkg.go.dev/` + `modules[0].path`                                                                                                                        |
| `source_path`          | Module path suffix after `go.opentelemetry.io/contrib/`                                                                                                          |
| `instrumentation_type` | Path prefix: `instrumentation/` -> `wrapper`, `bridges/` -> `bridge`, `exporters/` -> `exporter`, `propagators/` -> `propagator`, `samplers/` -> `sdk-component` |
| `installation.methods` | `wrapper` type -> `[wrapper]`; all others -> `[import]`                                                                                                          |
| `target_module`        | Stripped from path (e.g. `otelhttp` -> `net/http`); optional, omitted for global instrumentation without a specific target (e.g. `otel/init`).                   |
| `stability`            | Defaults to `experimental`; update manually after checking upstream                                                                                              |
| `hidden`               | Excludes the instrumentation from the explorer UI.                                                                                                               |

For inferred metadata (e.g. `go-contrib`), fields that cannot be derived are left empty for manual
completion: `description`, `installation.description`, `installation.example`,
`semantic_conventions`, `configurations`.
