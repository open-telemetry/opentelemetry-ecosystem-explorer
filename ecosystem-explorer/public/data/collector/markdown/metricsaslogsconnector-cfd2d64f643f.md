> **Deprecation Notice:** The component type has been renamed from `metricsaslogs` to `metrics_as_logs`
> to follow the OpenTelemetry snake_case naming convention.
> The old name `metricsaslogs` still works but is deprecated and will be removed in a future release.
> Please update your configuration to use `metrics_as_logs`.

This connector converts OpenTelemetry metrics into logs, creating one log entry per metric data point. Each metric data point is transformed into a structured log record with configurable JSON body format.

## Current Limitations

⚠️ **Current implementation discards the following metric features:**
- Metric exemplars
- Advanced metadata

These features may be added in future iterations.

## Configuration

The following settings can be optionally configured:

- `include_resource_attributes` (default = `true`): Whether to include resource attributes in the generated logs
- `include_scope_info` (default = `true`): Whether to include instrumentation scope information in the generated logs

## Log Body Format

The connector always generates log bodies in the following JSON format:
```json
{"metric_name": "$NAME", "value": "$VALUE"}
```

Where:
- `$NAME` is the actual metric name
- `$VALUE` is the metric value (simple values for gauge/sum, complex JSON for histogram/summary)

## Example Usage

### Basic Configuration

```yaml
connectors:
  metrics_as_logs:

service:
  pipelines:
    logs:
      receivers: [metrics_as_logs]
      processors: []
      exporters: [debug]
    metrics:
      receivers: [otlp]
      processors: []
      exporters: [metrics_as_logs]
```

### Advanced Configuration

```yaml
connectors:
  metrics_as_logs:
    include_resource_attributes: false
    include_scope_info: false
```


### Example Metric Conversions

For a gauge metric `cpu_usage` with value `85.2`:
```json
{
  "body": {"metric_name": "cpu_usage", "value": "85.2"},
  "attributes": {
    "metric.name": "cpu_usage",
    "metric.type": "Gauge",
    "metric.description": "CPU usage percentage",
    "metric.unit": "%"
  }
}
```

For a histogram metric `request_duration`:
```json
{
  "body": {
    "metric_name": "request_duration", 
    "value": "{\"count\":100,\"sum\":1.5,\"bucket_counts\":[10,50,40],\"explicit_bounds\":[0.1,0.5,1.0]}"
  },
  "attributes": {
    "metric.name": "request_duration",
    "metric.type": "Histogram",
    "metric.description": "Request duration in seconds",
    "metric.unit": "s",
    "metric.aggregation_temporality": "Delta"
  }
}
```

## Output Structure

Each metric data point is converted to a log record with:

- **Body**: Fixed JSON format: `{"metric_name": "$NAME", "value": "$VALUE"}`
- **Timestamp**: Metric data point timestamp
- **Observed Timestamp**: Metric data point start timestamp (if available)
- **Attributes**: 
  - Original metric data point attributes (labels)
  - `metric.name`: The metric name
  - `metric.type`: The metric type (Gauge, Sum, Histogram, etc.)
  - `metric.description`: Metric description (if available)
  - `metric.unit`: Metric unit (if available)
  - Additional type-specific attributes:
    - For Sum metrics: `metric.is_monotonic`, `metric.aggregation_temporality`
    - For Histogram/ExponentialHistogram: `metric.aggregation_temporality`
  - Resource attributes (if `include_resource_attributes` is true)
  - Instrumentation scope information (if `include_scope_info` is true)

## Supported Metric Types

All OpenTelemetry metric types are supported:

- **Gauge**: Point-in-time measurements
- **Sum**: Cumulative or delta measurements  
- **Histogram**: Distribution of measurements with buckets
- **Exponential Histogram**: Distribution with exponentially sized buckets
- **Summary**: Distribution with quantile values

## Value Encoding

The `value` field in the JSON body contains:

- For simple metrics (Gauge, Sum): numeric value as string
- For complex metrics (Histogram, etc.): JSON-encoded object as string

All JSON special characters in metric names and values are properly escaped.
