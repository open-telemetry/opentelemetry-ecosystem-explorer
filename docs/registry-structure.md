# Registry Structure

The ecosystem-registry stores raw, normalized metadata in aggregated YAML files, maintaining
complete historical records across versions. This data is later transformed into content-addressed
JSON for the web application.

## Directory Structure

```text
ecosystem-registry/
├── java/
│   └── javaagent/
│       ├── v2.28.0/
│       │   ├── instrumentation.yaml      # All instrumentations for this version
│       │   └── library_readmes/          # Per-library README markdown (content-addressed)
│       └── v2.28.1-SNAPSHOT/
│           ├── instrumentation.yaml
│           └── library_readmes/
├── dotnet/
│   ├── v1.15.3/
│   │   └── instrumentation.yaml          # All .NET instrumentations/exporters/extensions
│   └── v1.15.4-SNAPSHOT/
│       └── instrumentation.yaml
├── javascript/                           # Per-package, per-version (NOT aggregated)
│   └── instrumentation-express/
│       ├── v0.66.0.yaml                  # One file per version of this package
│       └── v0.65.0.yaml
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
    │   ├── v0.153.0/
    │   │   ├── receiver.yaml            # All core receivers
    │   │   ├── processor.yaml           # All core processors
    │   │   ├── exporter.yaml            # All core exporters
    │   │   ├── connector.yaml           # All core connectors
    │   │   └── extension.yaml           # All core extensions
    │   └── v0.153.1-SNAPSHOT/
    │       └── ...
    └── contrib/
        ├── v0.153.0/
        │   ├── receiver.yaml            # All contrib receivers
        │   ├── processor.yaml
        │   ├── exporter.yaml
        │   ├── connector.yaml
        │   └── extension.yaml
        └── v0.153.1-SNAPSHOT/
            └── ...
```

## Key Principles

- **Aggregated YAML files**: One file per component type per version (human-readable, git-friendly).
  The JavaScript ecosystem is the exception — its packages version independently, so it stores one
  file per package version rather than an aggregated per-version file (see
  [JavaScript Structure](#javascript-structure)).
- **Version-scoped**: Each version has a complete, independent snapshot that can be regenerated from
  source

## Java Agent Structure

### Version Directory Layout

```text
java/
└── javaagent/
    └── {version}/
        ├── instrumentation.yaml
        └── library_readmes/
            └── {name}-{hash}.md
```

**One aggregated file** per version containing all instrumentations, plus a `library_readmes/`
directory holding the upstream `library/README.md` for each instrumentation that ships one. The
README files are content-addressed (`{name}-{hash}.md`) so identical content is shared across
versions.

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
