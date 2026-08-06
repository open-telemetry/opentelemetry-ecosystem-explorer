# Instrumentation

This package scans the upstream
[opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) repository
and derives a metadata descriptor for each instrumentation module it finds. The watcher
(`cmd/watcher`) drives the scan with `ScanRepo` and writes the results into the versioned inventory
under `ecosystem-registry/go/contrib`.

Each subdirectory (for example `otelhttp/`) is a self-contained, runnable Go module that
demonstrates one or more contrib libraries end-to-end. These exemplars exist for manual inspection —
they are not inputs to the watcher. See `otelhttp/doc.go` for what an exemplar does.

## How fields are derived

`DeriveMetadata` (`metadata.go`) infers each descriptor field from a module's go-contrib path,
version, and declared Go version. `displayNameMap` and the bridge lookup tables live in `parser.go`
and `metadata.go`.

| Metadata field         | Derived from                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | Module path suffix after `go.opentelemetry.io/contrib/`, with `/` replaced by `-` (globally unique)                                                              |
| `display_name`         | `displayNameMap` / bridge tables, keyed on the path leaf minus the `otel` prefix                                                                                 |
| `module.path`          | The module path                                                                                                                                                  |
| `module.version`       | The resolved module version                                                                                                                                      |
| `go_min_version`       | `go` directive in the module's `go.mod`                                                                                                                          |
| `scope.name`           | Same as `module.path`                                                                                                                                            |
| `library_link`         | `https://pkg.go.dev/` + `module.path`                                                                                                                            |
| `source_path`          | Module path suffix after `go.opentelemetry.io/contrib/`                                                                                                          |
| `instrumentation_type` | Path prefix: `instrumentation/` -> `wrapper`, `bridges/` -> `bridge`, `exporters/` -> `exporter`, `propagators/` -> `propagator`, `samplers/` -> `sdk-component` |
| `installation.type`    | `wrapper` type -> `wrapper`; all others -> `import`                                                                                                              |
| `target_module`        | Stripped from path (e.g. `instrumentation/net/http/otelhttp` -> `net/http`); bridge targets use a static lookup table                                            |
| `stability`            | Defaults to `experimental`; update manually after checking upstream                                                                                              |

Fields not inferred are left empty for manual completion: `description`, `installation.description`,
`installation.example`, `semantic_conventions`, `configurations`.
