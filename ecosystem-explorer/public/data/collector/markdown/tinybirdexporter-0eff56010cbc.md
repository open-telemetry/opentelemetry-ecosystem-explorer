## Description

This exporter sends logs, metrics, and traces to [Tinybird](https://www.tinybird.co/) via the [Events API](https://www.tinybird.co/docs/api-reference/events-api).

Tinybird is a real-time analytics platform for ingesting, transforming, and serving data with low latency and high throughput. Telemetry data sent to Tinybird can be queried and analyzed in real time using SQL.``


## Quick Start

Looking for a quick start? Check out our [Open Telemetry Template](https://github.com/tinybirdco/tinybird-otel-template), which provides a ready-to-use example for configuring the Tinybird OpenTelemetry Exporter.

## Configuration

### Required settings

- `endpoint` (no default): The Tinybird API endpoint URL (e.g., `https://api.us-east.aws.tinybird.co`)
- `token` (no default): Your Tinybird API token used for authentication

### Optional settings

- `metrics`: Configuration for different metric types
  - `gauge::datasource` (default: `gauge`): Name of the gauge metrics data source
  - `sum::datasource` (default: `sum`): Name of the sum metrics data source  
  - `histogram::datasource` (default: `histogram`): Name of the histogram metrics data source
  - `exponential_histogram::datasource` (default: `exponential_histogram`): Name of the exponential histogram metrics data source
- `traces::datasource` (default: `traces`): Name of the traces data source
- `logs:datasource` (default: `logs`): Name of the logs data source
- `wait` (default: `false`): Whether to wait for data to be ingested before returning a response
- `retry_on_failure`: Configuration for retry behavior on failures
- `sending_queue`: Configuration for the sending queue


### Basic Configuration

```yaml
exporters:
  tinybird:
    endpoint: ${OTEL_TINYBIRD_API_HOST}
    token: ${OTEL_TINYBIRD_TOKEN}
```

### Advanced Configuration

```yaml
exporters:
  tinybird:
    endpoint: ${OTEL_TINYBIRD_API_HOST}
    token: ${OTEL_TINYBIRD_TOKEN}
    wait: true
    metrics:
      gauge:
        datasource: "metrics_gauge"
      sum:
        datasource: "metrics_sum"
      histogram:
        datasource: "metrics_histogram"
      exponential_histogram:
        datasource: "metrics_exponential_histogram"
    traces:
      datasource: "traces"
    logs:
      datasource: "logs"
    retry_on_failure:
      enabled: true
    sending_queue:
      enabled: true
      queue_size: 104857600     # 100 MB total buffer size
      sizer: bytes
      batch:
        flush_timeout: 5s
        min_size: 1024000     # 1 MB min batch size
        max_size: 10000000    # ~10 MB max batch size
```

## Data Source Requirements

Before using this exporter, you need to create the corresponding data sources in your Tinybird workspace. The data source names must:

- Only contain letters, numbers, and underscores
- Match the data source names specified in your configuration


## Authentication

The exporter uses API token authentication. You can provide the token in several ways:

1. **Environment Variable** (recommended):
   ```yaml
   token: ${OTEL_TINYBIRD_TOKEN}
   ```

2. **Direct configuration**:
   ```yaml
   token: "your-tinybird-token-here"
   ```

## Error Handling

The exporter includes built-in retry logic for handling temporary failures. You can configure retry behavior using the `retry_on_failure` settings:

- `enabled`: Enable/disable retry logic
- `initial_interval`: Initial retry interval
- `max_interval`: Maximum retry interval
- `max_elapsed_time`: Maximum total time to retry

## Performance Considerations

- Use the `sending_queue` configuration to buffer data and improve throughput
- Set `wait: false` for better performance (default behavior)

## Example: Complete Pipeline Configuration

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

exporters:
  tinybird:
    endpoint: ${OTEL_TINYBIRD_API_HOST}
    token: ${OTEL_TINYBIRD_TOKEN}
    metrics:
      gauge:
        datasource: "otel_metrics_gauge"
      sum:
        datasource: "otel_metrics_sum"
      histogram:
        datasource: "otel_metrics_histogram"
      exponential_histogram:
        datasource: "otel_metrics_exponential_histogram"
    traces:
      datasource: "otel_traces"
    logs:
      datasource: "otel_logs"

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [tinybird]
    metrics:
      receivers: [otlp]
      exporters: [tinybird]
    logs:
      receivers: [otlp]
      exporters: [tinybird]
```