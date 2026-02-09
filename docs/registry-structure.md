# Registry Structure

The ecosystem-registry stores raw, normalized metadata in aggregated YAML files, maintaining
complete historical records across versions. This data is later transformed into
content-addressed JSON for the web application.

## Directory Structure

```text
ecosystem-registry/
├── java/
│   └── javaagent/
│       ├── v2.24.0/
│       │   └── instrumentation.yaml      # All instrumentations for this version
│       └── v2.24.1-SNAPSHOT/
│           └── instrumentation.yaml
└── collector/
    ├── core/
    │   ├── v0.145.0/
    │   │   ├── receiver.yaml            # All core receivers
    │   │   ├── processor.yaml           # All core processors
    │   │   ├── exporter.yaml            # All core exporters
    │   │   ├── connector.yaml           # All core connectors
    │   │   └── extension.yaml           # All core extensions
    │   └── v0.145.1-SNAPSHOT/
    │       └── ...
    └── contrib/
        ├── v0.145.0/
        │   ├── receiver.yaml            # All contrib receivers
        │   ├── processor.yaml
        │   ├── exporter.yaml
        │   ├── connector.yaml
        │   └── extension.yaml
        └── v0.145.1-SNAPSHOT/
            └── ...
```

## Key Principles

- **Aggregated YAML files**: One file per component type per version (human-readable, git-friendly)
- **Version-scoped**: Each version has a complete, independent snapshot that can be regenerated from source

## Java Agent Structure

### Version Directory Layout

```text
java/
└── javaagent/
    └── {version}/
        └── instrumentation.yaml
```

**One aggregated file** per version containing all instrumentations.

### File Format

**Example**: `java/javaagent/v2.24.0/instrumentation.yaml`

```yaml
file_format: 0.1
libraries:
  - name: activej-http-6.0
    display_name: ActiveJ
    description: This instrumentation enables HTTP server spans and metrics...
    semantic_conventions:
      - HTTP_SERVER_SPANS
      - HTTP_SERVER_METRICS
    library_link: https://activej.io/
    source_path: instrumentation/activej-http-6.0
    minimum_java_version: 17
    scope:
      name: io.opentelemetry.activej-http-6.0
      schema_url: https://opentelemetry.io/schemas/1.37.0
    target_versions:
      javaagent:
        - "io.activej:activej-http:[6.0,)"
    configurations:
      - name: otel.instrumentation.http.known-methods
        description: Configures the instrumentation to recognize...
        type: list
        default: CONNECT,DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT,TRACE
    telemetry:
      - when: default
        metrics:
          - name: http.server.request.duration
            description: Duration of HTTP server requests
            type: HISTOGRAM
            unit: s
            attributes:
              - name: http.request.method
                type: STRING
              - name: http.response.status_code
                type: LONG
        spans:
          - span_kind: SERVER
            attributes:
              - name: http.request.method
                type: STRING
              - name: http.response.status_code
                type: LONG

  - name: aws-sdk-2.2
    display_name: AWS SDK 2.2
    # ... (next instrumentation)

  # ... (continues for all ~232 instrumentations)
```

**Key Features**:

- `libraries`: Array of all instrumentations
- Complete metadata for each instrumentation in a single file

## Collector Structure

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
  - name: activedirectorydsreceiver
    metadata:
      type: active_directory_ds
      status:
        class: receiver
        stability:
          beta:
            - metrics
        distributions:
          - contrib
        codeowners:
          active:
            - pjanotti
          seeking_new: true
        unsupported_platforms:
          - darwin
          - linux
      attributes:
        bind_type:
          description: The type of bind to the domain server
          type: string
          enum:
            - client
            - server
      # ... (more attributes)
      metrics:
        # ... (metric definitions)

  - name: aerospikereceiver
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

**Format**: `v2.24.0`, `v0.145.0`
**Directory**: `{ecosystem}/{version}/`
**Characteristics**: Immutable, represents official release

### Snapshot Versions

**Format**: `v2.24.1-SNAPSHOT`
**Directory**: `{ecosystem}/{version}-SNAPSHOT/`
**Characteristics**: Extracted from `main` branch, shows work-in-progress
**Updates**: Nightly via GitHub Actions
