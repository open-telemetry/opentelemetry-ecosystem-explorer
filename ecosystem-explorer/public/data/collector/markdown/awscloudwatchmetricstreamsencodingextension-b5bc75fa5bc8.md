The extension can be configured to unmarshal metrics in either the JSON or OpenTelemetry 1.0.0 output formats.
At this time the OpenTelemetry 0.7.0 output format is unsupported, there are no plans to add support for it.

Example for OpenTelemetry 1.0.0 format:
```yaml
extensions:
  awscloudwatchmetricstreams_encoding:
    format: opentelemetry1.0
```

Example for JSON format:
```yaml
extensions:
  awscloudwatchmetricstreams_encoding:
    format: json
```

## Streaming Support

The table below summarizes offset tracking details for each format,

| CloudWatch Metrics format | Offset Tracking |
|---------------------------|-----------------|
| Opentelemetry             | Bytes processed |
| JSON                      | Bytes processed |

## Supported Statistics (JSON format)

When using the JSON format, the extension extracts the following statistics from CloudWatch Metric Streams and converts them to OpenTelemetry Summary metrics:

**Always extracted:**
- `min` - Minimum value (converted to quantile 0)
- `max` - Maximum value (converted to quantile 1)
- `sum` - Sum of values
- `count` - Sample count

**Percentiles (extracted as quantile values):**
- `p50`, `p90`, `p95`, `p99`, `p99.9`, etc. - Percentile values are converted to quantiles by dividing by 100 (e.g., `p99` becomes quantile `0.99`)

**Not supported (silently ignored):**

The following [additional statistics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-metric-streams-statistics.html) that can be configured in CloudWatch Metric Streams are not extracted, as they do not map well to OpenTelemetry Summary quantiles:

- Trimmed Mean (`TM(X%:Y%)`, `tm99`, `IQM`)
- Winsorized Mean (`WM(X%:Y%)`, `wm98`)
- Trimmed Count (`TC(X%:Y%)`, `tc90`)
- Trimmed Sum (`TS(X%:Y%)`, `ts90`)
- Percentile Rank (`PR(:X)`, `PR(X:Y)`)
