Allows for health based routing between trace, metric, and log pipelines depending on the health of target downstream exporters.

## Configuration

If you are not already familiar with connectors, you may find it helpful to first visit the [Connectors README].

The following settings are available:

- `priority_levels (required)`: list of pipeline level priorities in a 1 - n configuration, multiple pipelines can sit at a single priority level.
- `retry_interval (optional)`: the frequency at which the pipeline levels will attempt to reestablish connection with all higher priority levels. Default value is 10 minutes. (See Example below for further explanation)

The connector intakes a list of `priority_levels` each of which can contain multiple pipelines.
If any pipeline at a stable level fails, the level is considered unhealthy and the connector will move down one priority level and route all data to the new level (assuming it is stable).

The connector will periodically try to reestablish a stable connection with the higher priority levels. `retry_interval` will be the frequency at which the connector will try to iterate through all unhealthy higher priority levels.

#### Configuration Example:

```yaml
connectors:
  failover:
    priority_levels:
      - [traces/first, traces/also_first]
      - [traces/second]
      - [traces/third]
    retry_interval: 10s

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [failover]
    traces/first:
      receivers: [failover]
      exporters: [otlp_grpc/first]
    traces/second:
      receivers: [failover]
      exporters: [otlp_grpc/second]
    traces/third:
      receivers: [failover]
      exporters: [otlp_grpc/third]
    traces/also_first:
      receivers: [failover]
      exporters: [otlp_grpc/fourth]
```

[Connectors README]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md
[Exporter Pipeline Type]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md#exporter-pipeline-type
[Receiver Pipeline Type]:https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md#receiver-pipeline-type
[contrib]:https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
