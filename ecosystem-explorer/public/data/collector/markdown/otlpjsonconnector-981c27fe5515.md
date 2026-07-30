> **Deprecation Notice:** The component type has been renamed from `otlpjson` to `otlp_json`
> to follow the OpenTelemetry snake_case naming convention.
> The old name `otlpjson` still works but is deprecated and will be removed in a future release.
> Please update your configuration to use `otlp_json`.


Allows to extract otlpjson data from incoming Logs and specifically the `Body` field.
The data is written in
[Protobuf JSON
encoding](https://developers.google.com/protocol-buffers/docs/proto3#json)
using [OpenTelemetry
protocol](https://github.com/open-telemetry/opentelemetry-proto).

## Configuration

#### Configuration Example:

```yaml
receivers:
  file_log:
    include:
      - /var/log/foo.log

exporters:
  debug:

connectors:
  # Deprecated (still works):
  # otlpjson:
  # New name:
  otlp_json:

service:
  pipelines:
    logs/raw:
      receivers: [file_log]
      exporters: [otlpjson]
    metrics/otlp:
      receivers: [otlpjson]
      exporters: [debug]
    logs/otlp:
      receivers: [otlpjson]
      exporters: [debug]
    traces/otlp:
      receivers: [otlpjson]
      exporters: [debug]
```

[Connectors README]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md
[Exporter Pipeline Type]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md#exporter-pipeline-type
[Receiver Pipeline Type]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md#receiver-pipeline-type
[contrib]:https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
