> [!NOTE]
> This component is a work-in-progress. See [#50965](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/50965).

## Getting Started

The `telemetry_policy` processor natively interprets and enforces standardized,
declarative Telemetry Policies across traces, metrics, and logs for sampling,
filtering, and scoped transformations, with built-in hit/miss observability.

Policies are atomic, fail-open, portable across runtimes (SDKs, Collector, agents),
and dynamically sourced from policy provider extensions (such as `file_telemetry_policy`).

## Configuration

The following settings are available:

- `providers` (required): The list of policy provider extension IDs to consume policies from.

### Example Configuration

```yaml
extensions:
  file_telemetry_policy:
    path: /etc/otel/policies.yaml

processors:
  telemetry_policy:
    providers: [file_telemetry_policy]

service:
  extensions: [file_telemetry_policy]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [telemetry_policy, batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [telemetry_policy, batch]
      exporters: [otlp]
    logs:
      receivers: [otlp]
      processors: [telemetry_policy, batch]
      exporters: [otlp]
```
