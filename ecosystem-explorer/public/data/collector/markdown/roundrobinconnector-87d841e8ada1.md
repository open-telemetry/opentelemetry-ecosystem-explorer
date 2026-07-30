> **Deprecation Notice:** The component type has been renamed from `roundrobin` to `round_robin`
> to follow the OpenTelemetry snake_case naming convention.
> The old name `roundrobin` still works but is deprecated and will be removed in a future release.
> Please update your configuration to use `round_robin`.

The `round_robin` connector can fork pipelines of the same type and equally split the load between them.

## Configuration

If you are not already familiar with connectors, you may find it helpful to first visit the [Connectors README].

The `roundrobin` connector does not have any configuration settings.

```yaml
receivers:
  otlp:
exporters:
  prometheus_remote_write/1:
  prometheus_remote_write/2:
connectors:
  round_robin:
```

Preprocess data, then export using multiple exporter instances to scale the throughput if the exporter 
does not support scale well (e.g. prometheus_remote_write).

```yaml
receivers:
  otlp:
processors:
  resource_detection:
exporters:
  prometheus_remote_write/1:
  prometheus_remote_write/2:
connectors:
  round_robin:
service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [resource_detection]
      exporters: [round_robin]
    metrics/1:
      receivers: [round_robin]
      exporters: [prometheus_remote_write/1]
    metrics/2:
      receivers: [round_robin]
      exporters: [prometheus_remote_write/2]
```

[Connectors README]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md
