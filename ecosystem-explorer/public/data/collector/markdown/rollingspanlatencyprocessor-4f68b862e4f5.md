# Rolling Span Latency Processor

Labels spans as `slow` or `very_slow` based on a per-key rolling latency baseline, so that
downstream tail-sampling, alerting, or routing decisions can react to spans that are anomalously
slow relative to their own historical behavior rather than a fixed static threshold.

For each incoming span, the processor computes a key from the span name and a configurable set of
resource attributes (e.g. service name, namespace, deployment environment), and maintains an
exponentially-weighted moving average (EWMA) of that key's duration. Once a key has accumulated
enough observations to warm up, spans whose duration deviates from the rolling mean by more than a
configured number of standard deviations are labeled accordingly.

> [!NOTE]
> This component currently only establishes its configuration and component structure. The
> rolling-baseline tracking and attribute-labeling logic will be added in a follow-up PR, per the
> [donation process](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/docs/new-components.md).
> Until then, this processor passes traces through unchanged.

## Configuration

```yaml
processors:
  rolling_span_latency:
    # Span attribute written once a baseline has warmed up.
    attribute_key: latency.category

    # Resource attributes combined with the span name to form each baseline's key.
    resource_key_attributes:
      - service.namespace
      - service.name
      - deployment.environment.name

    # How quickly the rolling mean/variance forgets older observations.
    half_life: 2h

    # How long a baseline can go without an observation before it is evicted.
    idle_timeout: 8h

    # How often the processor scans for and evicts idle baselines.
    eviction_interval: 10m

    # Standard deviations above the rolling mean to label a span "slow".
    slow_threshold: 3.0

    # Standard deviations above the rolling mean to label a span "very_slow".
    very_slow_threshold: 4.0

    # Fraction of baselines evicted in one sweep above which a high-cardinality warning is logged.
    churn_warning_ratio: 0.5

    # Floor applied to a baseline's rolling standard deviation.
    min_stddev: 1ms

    # Maximum number of concurrently tracked baselines (0 = unlimited).
    max_baselines: 1000

    # Observations a baseline must accumulate before spans are labeled against it.
    warmup_count: 30
```

## Warnings

`resource_key_attributes` combined with the span name determines the cardinality of tracked
baselines. Choosing attributes with many unique values (e.g. a per-request ID) can lead to
unbounded memory growth; use `max_baselines` to bound this and watch for the high-cardinality
warning gated by `churn_warning_ratio`.
