# Registry Structure

The ecosystem-registry stores raw, normalized metadata in aggregated YAML files, maintaining
complete historical records across versions. This data is later transformed into content-addressed
JSON for the web application.

## Directory Structure

```text
ecosystem-registry/
├── java/
│   └── javaagent/
│       ├── library_readmes/              # Shared content-addressed README markdown
│       ├── v2.28.0/
│       │   ├── instrumentation.yaml      # All instrumentations for this version
│       │   └── library-readmes.yaml      # Raw library name -> shared filename
│       └── v2.28.1-SNAPSHOT/
│           ├── instrumentation.yaml
│           └── library-readmes.yaml
├── dotnet/
│   ├── v1.15.3/
│   │   └── instrumentation.yaml          # All .NET instrumentations/exporters/extensions
│   └── v1.15.4-SNAPSHOT/
│       └── instrumentation.yaml
├── javascript/                           # Per-package, per-version (NOT aggregated)
│   └── instrumentation-express/
│       ├── v0.66.0.yaml                  # One file per version of this package
│       └── v0.65.0.yaml
├── python/                               # Per-package, per-version (NOT aggregated)
│   └── opentelemetry-instrumentation-example/
│       ├── v0.49b0.yaml                  # One file per version of this package
│       └── v0.48b0.yaml
├── configuration/
│   ├── v1.0.0/
│   │   ├── opentelemetry_configuration.yaml   # Root declarative-config schema
│   │   ├── common.yaml                        # Shared schema fragments
│   │   ├── tracer_provider.yaml               # Per-section schemas
│   │   ├── meter_provider.yaml
│   │   ├── ...                                # logger_provider, propagator, resource, etc.
│   │   └── meta_schema_language_*.yaml        # Per-language meta-schema variants
│   └── v1.0.1-SNAPSHOT/
│       └── ...
└── collector/
    ├── deprecations.yaml                # Cross-version deprecation baseline
    ├── meta/
    │   └── schemas/                     # Content-addressed metadata-schema snapshots
    ├── core/
    │   ├── readmes/                     # Shared core README store
    │   ├── v0.153.0/
    │   │   ├── receiver.yaml            # All core receivers
    │   │   ├── processor.yaml           # All core processors
    │   │   ├── exporter.yaml            # All core exporters
    │   │   ├── connector.yaml           # All core connectors
    │   │   ├── extension.yaml           # All core extensions
    │   │   └── component-readmes.yaml   # Raw component name -> shared filename
    │   └── v0.153.1-SNAPSHOT/
    │       └── ...
    └── contrib/
        ├── readmes/                     # Shared contrib README store
        ├── v0.153.0/
        │   ├── receiver.yaml            # All contrib receivers
        │   ├── processor.yaml
        │   ├── exporter.yaml
        │   ├── connector.yaml
        │   ├── extension.yaml
        │   └── component-readmes.yaml
        └── v0.153.1-SNAPSHOT/
            └── ...
```

## Key Principles

- **Aggregated YAML files**: One file per component type per version (human-readable, git-friendly).
  JavaScript and Python are the exceptions — their packages version independently (Python via a
  hybrid lockstep/independent model), so each stores one file per package version rather than an
  aggregated per-version file (see [JavaScript Structure](#javascript-structure) and
  [Python Structure](#python-structure)).
- **Version-scoped**: Each version has a complete, independent snapshot that can be regenerated from
  source

## Java Agent Structure

### Version Directory Layout

```text
java/
└── javaagent/
    ├── library_readmes/
    │   └── {safe_name}-{hash12}.md
    └── {version}/
        ├── instrumentation.yaml
        └── library-readmes.yaml
```

**One aggregated file** per version contains all instrumentations. A `library-readmes.yaml` index
maps raw library names to content-addressed filenames in the shared `library_readmes/` store.
Collector versions use `component-readmes.yaml` with the same mapping format and a separate
`readmes/` store per distribution. Index keys are sorted; filenames use sanitized names and the
first 12 hex characters of the SHA-256 hash of the original bytes. An explicit empty mapping (`{}`)
is a completed sync; a missing index means READMEs have not been synced successfully. The Java and
Collector watchers retry missing indexes for every tracked release using that release's upstream
tag, including historical versions. All indexes are validated before unreferenced shared files are
pruned.

### File Format

**Example**: `java/javaagent/v2.24.0/instrumentation.yaml`

```yaml
file_format: 0.1
libraries:
  - name: activej-http-6.0
    display_name: ActiveJ
    description: This instrumentation enables HTTP server spans and metrics...
    semantic_conventions:
      * HTTP_SERVER_SPANS
      * HTTP_SERVER_METRICS
    library_link: https://activej.io/
    source_path: instrumentation/activej-http-6.0
    minimum_java_version: 17
    scope:
      name: io.opentelemetry.activej-http-6.0
      schema_url: https://opentelemetry.io/schemas/1.37.0
    target_versions:
      javaagent:
        * "io.activej:activej-http:[6.0,)"
    configurations:
      * name: otel.instrumentation.http.known-methods
        description: Configures the instrumentation to recognize...
        type: list
        default: CONNECT,DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT,TRACE
    telemetry:
      * when: default
        metrics:
          * name: http.server.request.duration
            description: Duration of HTTP server requests
            type: HISTOGRAM
            unit: s
            attributes:
              * name: http.request.method
                type: STRING
              * name: http.response.status_code
                type: LONG
        spans:
          * span_kind: SERVER
            attributes:
              * name: http.request.method
                type: STRING
              * name: http.response.status_code
                type: LONG

  * name: aws-sdk-2.2
    display_name: AWS SDK 2.2
    # ... (next instrumentation)

  # ... (continues for every instrumentation in this version)
```

**Key Features**:

- `libraries`: Array of all instrumentations
- Complete metadata for each instrumentation in a single file

## .NET Structure

### .NET Version Directory Layout

```text
dotnet/
└── {version}/
    └── instrumentation.yaml
```

**One aggregated file** per version containing all .NET automatic-instrumentation components
(instrumentations, exporters, and extensions). Unlike Java, there is no distribution sub-directory.

## JavaScript Structure

Unlike the other ecosystems, JavaScript instrumentations are **not** aggregated into a single
per-version file. The `opentelemetry-js-contrib` packages version independently, so each package
gets its own directory and one YAML file per version of that package.

### JavaScript Version Directory Layout

```text
javascript/
└── {package-name}/                 # e.g. instrumentation-express
    └── v{version}.yaml             # e.g. v0.66.0.yaml — one file per version of this package
```

### JavaScript File Format

**Example**: `javascript/instrumentation-express/v0.66.0.yaml`

```yaml
component_owners:
  - JamieDanielson
  - pkanal
description: OpenTelemetry instrumentation for `express` http web application framework
in_auto_instrumentations_node: true
name: instrumentation-express
node_engine: ^18.19.0 || >=20.6.0
npm_package: "@opentelemetry/instrumentation-express"
repository: open-telemetry/opentelemetry-js-contrib
source_path: packages/instrumentation-express
supported_versions: # parsed from the package README "Supported Versions" section
  - package: express
    source: README.md
    version_range: ">=4.0.0 <6"
tested_versions: # parsed from the package .tav.yml
  - mode: latest-minors
    package: express
    range: ">=4.16.2 <6"
    source: .tav.yml
version: 0.66.0
```

**Key Features**:

- One file per package version, keyed by the package directory name (e.g. `instrumentation-express`)
- `supported_versions` is scraped from the package README; `tested_versions` from `.tav.yml`
- `in_auto_instrumentations_node` records whether the package is part of the Node
  auto-instrumentation bundle

## Python Structure

Like JavaScript, Python instrumentation packages are **not** aggregated into a single per-version
file. `opentelemetry-python-contrib` follows a hybrid versioning model — most instrumentation
packages release in lockstep with the repository's release cadence, but a growing subset version
independently — so every package gets its own directory and one YAML file per version of that
package, regardless of which release pattern it follows.

### Python Version Directory Layout

```text
python/
└── {package-name}/                 # PyPI distribution name, e.g. opentelemetry-instrumentation-flask
    └── v{version}.yaml             # e.g. v0.48b0.yaml — one file per version of this package
```

### Python File Format

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

**Key Features**:

- One file per package version, keyed by the PyPI distribution name (also the `instrumentation/`
  directory name)
- Metadata is sourced from `pyproject.toml` (authoritative for `instruments`, `entry_points`,
  `requires_python`, `homepage`) and cross-checked against `package.py`;
  `semantic_convention_status` and `supports_metrics` come from `package.py` only, since
  `pyproject.toml` has no equivalent
- `instruments[].source_key` preserves which `pyproject.toml` key (`instruments` or
  `instruments-any`) an entry came from, rather than collapsing the two
- Disagreements between `pyproject.toml` and `package.py` are logged and reported, never fatal —
  `pyproject.toml` remains authoritative for the registry's `instruments` field
- No `-SNAPSHOT` versions: unlike Java/.NET/collector/configuration, the watcher checks out the most
  recent release tag before parsing and only extracts packages with a real published version, since
  `main`'s `version.py` always holds an unreleased `.dev` version that never changes between
  releases

## Configuration Structure

The declarative configuration schema is split into one YAML file per schema section.

### Configuration Version Directory Layout

```text
configuration/
└── {version}/
    ├── opentelemetry_configuration.yaml   # Root schema
    ├── common.yaml                        # Shared fragments
    ├── tracer_provider.yaml
    ├── meter_provider.yaml
    ├── logger_provider.yaml
    ├── propagator.yaml
    ├── resource.yaml
    ├── instrumentation.yaml
    └── meta_schema_language_{cpp,go,java,js,php}.yaml
```

Versions track the upstream `opentelemetry-configuration` schema releases (e.g. `v1.0.0`). As with
the other non-collector ecosystems there is no distribution sub-directory.

## Collector Structure

In addition to the per-distribution version directories below, the collector registry keeps two
shared artifacts at the `collector/` root: `deprecations.yaml` (the cross-version deprecation
baseline maintained by the watcher) and `meta/schemas/` (content-addressed snapshots of the upstream
`metadata-schema.yaml`).

### Distribution Directory Layout

```text
collector/
├── core/
│   └── {version}/
│       ├── receiver.yaml
│       ├── processor.yaml
│       ├── exporter.yaml
│       ├── connector.yaml
│       └── extension.yaml
└── contrib/
    └── {version}/
        ├── receiver.yaml
        ├── processor.yaml
        ├── exporter.yaml
        ├── connector.yaml
        └── extension.yaml
```

**One file per component type** per distribution per version.

### Component File Format

**Example**: `collector/contrib/v0.145.0/receiver.yaml`

```yaml
distribution: contrib
version: 0.145.0
repository: opentelemetry-collector-contrib
component_type: receiver
components:
  * name: activedirectorydsreceiver
    metadata:
      type: active_directory_ds
      status:
        class: receiver
        stability:
          beta:
            * metrics
        distributions:
          * contrib
        codeowners:
          active:
            * pjanotti
          seeking_new: true
        unsupported_platforms:
          * darwin
          * linux
      attributes:
        bind_type:
          description: The type of bind to the domain server
          type: string
          enum:
            * client
            * server
      # ... (more attributes)
      metrics:
        # ... (metric definitions)

  * name: aerospikereceiver
    metadata:
      # ... (next receiver)

  # ... (continues for all receivers in contrib)
```

**Key Features**:

- `distribution`: core or contrib
- `repository`: Source repository name
- `component_type`: receiver, processor, exporter, connector, or extension
- `components`: Array of all components of this type

## Version Types

### Release Versions

**Format**: `v2.24.0`, `v0.145.0` **Directory**: `{ecosystem}/{version}/` **Characteristics**:
Immutable, represents official release

### Snapshot Versions

**Format**: `v2.24.1-SNAPSHOT` **Directory**: `{ecosystem}/{version}-SNAPSHOT/` **Characteristics**:
Extracted from `main` branch, shows work-in-progress **Updates**: Nightly via GitHub Actions
