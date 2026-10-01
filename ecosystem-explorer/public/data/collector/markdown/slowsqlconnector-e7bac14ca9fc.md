> **Deprecation Notice:** The component type has been renamed from `slowsql` to `slow_sql`
> to follow the OpenTelemetry snake_case naming convention.
> The old name `slowsql` still works but is deprecated and will be removed in a future release.
> Please update your configuration to use `slow_sql`.

## Overview

Generate logs from recorded [slow database statement](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/exceptions/exceptions-spans.md/) associated with spans.

Each **log** will have _at least_ the following dimensions:
- Service name
- Span kind
- Span name
- Status code
- Trace ID
- Span ID
- Database System
- Database Statement
- Database Statement Duration

Each log will additionally have the following attributes:
- Span attributes. If you want to filter out some attributes (like only copying HTTP attributes starting with `http.`) use the [transform processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor/).

## Configurations

If you are not already familiar with connectors, you may find it helpful to first visit the [Connectors README].

The following settings can be optionally configured:
- `dimensions`: the list of dimensions to add to *logs* with the default dimensions defined above.
  Each additional dimension is defined with a `name` which is looked up in the span's collection of attributes or
  resource attributes (AKA process tags) such as `ip`, `host.name` or `region`.
- `db_system:` the list value of span attribute `db.system`, Filter specific db systems, define those database's statements need to be collected. ref: https://opentelemetry.io/docs/specs/semconv/attributes-registry/db/
    - Default: `[h2, mongodb, mssql, mysql, oracle, postgresql, mariadb]`
- `threshold`: define a threshold and collect when the `db.statement`, namely span duration, larger than this value.
    - Default: `500ms`

## Examples

The following is a simple example usage of the `slow sql` connector.

```yaml
receivers:
  nop:

exporters:
  nop:

connectors:
  slow_sql:
    threshold: 600ms
    dimensions:
      - name: k8s.namespace.name
      - name: k8s.pod.name

service:
  pipelines:
    traces:
      receivers: [nop]
      exporters: [slow_sql]
    logs:
      receivers: [slow_sql]
      exporters: [nop]      
```

The following is a more complex example usage of the `slow_sql` connector using Elasticsearch as exporters.

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

exporters:
  elasticsearch/slow_sql:
    tls:
      insecure: true
    mapping:
      mode: raw
    endpoints:
      - http://localhost:9200
    user: elastic
    password: elastic

connectors:
  slow_sql:
    threshold: 600ms
    dimensions:
      - name: k8s.namespace.name
      - name: k8s.pod.name

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [slow_sql]
    logs:
      receivers: [slow_sql]
      exporters: [elasticsearch/slow_sql]
```

The full list of settings exposed for this connector is documented in [slowsqlconnector/config.go](../../connector/slowsqlconnector/config.go).
### More Examples

For more example configuration covering various other use cases, please visit the [testdata directory](../../connector/slowsqlconnector/testdata).

[Connectors README]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md
