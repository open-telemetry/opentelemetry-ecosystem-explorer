# Rolling Span Latency Processor

Labels spans as `slow` or `very_slow` based on a per-key rolling latency baseline, so that
downstream tail-sampling, alerting, or routing decisions can react to spans that are anomalously
slow relative to their own historical behavior rather than a fixed static threshold.

For each incoming span, the processor computes a key from the span name and a configurable set of
resource attributes (e.g. service name, namespace, deployment environment), and maintains an
exponentially-weighted moving average (EWMA) of that key's duration. Once a key has accumulated
enough observations to warm up, spans whose duration deviates from the rolling mean by more than a
configured number of standard deviations are labeled accordingly.

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

    # Maximum number of concurrently tracked baselines. Default is 0 (unlimited);
    # set this when resource_key_attributes plus span name can produce high
    # cardinality, to bound memory growth.
    max_baselines: 0

    # Observations a baseline must accumulate before spans are labeled against it.
    warmup_count: 30

    # If non-empty, only spans whose kind matches one of these values (plus any
    # matched by always_include_root_spans) are tracked and labeled. Accepted
    # values (case-insensitive): INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER.
    # Default: empty, meaning no span_kind-based filtering.
    span_kinds: [SERVER, CONSUMER]

    # If true, every root span (a span with no parent span ID) is tracked and
    # labeled regardless of its kind, in addition to any spans matched by
    # span_kinds. A value of false does not drop or exclude root spans — it
    # just means they get no special treatment and are evaluated the same as
    # any other span, purely via span_kinds (or the unfiltered default below,
    # if span_kinds is also empty). Default: false.
    always_include_root_spans: false
```

## Filtering which spans are evaluated

By default, with both `span_kinds` and `always_include_root_spans` left unset, every span —
including root spans — is tracked and eligible for labeling; neither option excludes anything on
its own. Setting either option switches the processor into filtering mode, where a span is tracked
only if it matches one of the two criteria below:

| `span_kinds`        | `always_include_root_spans` | Spans tracked                                   |
| ------------------- | ---------------------------- | ------------------------------------------------ |
| empty               | `false`                       | every span (no filtering; the default)           |
| empty               | `true`                        | root spans only                                  |
| non-empty           | `false`                       | spans whose kind is listed, root or not           |
| non-empty           | `true`                        | spans whose kind is listed, plus all root spans   |

Spans that don't match are passed through unmodified and never contribute to a baseline. Note the
second row: setting `always_include_root_spans: true` by itself does not add root spans on top of
"track everything" — since `span_kinds` contributes no matches when it's empty, the processor
narrows to root spans only. Set `span_kinds` too if you want root spans plus specific kinds.

## Warnings

`resource_key_attributes` combined with the span name determines the cardinality of tracked
baselines. Choosing attributes with many unique values (e.g. a per-request ID) can lead to
unbounded memory growth; use `max_baselines` to bound this and watch for the high-cardinality
warning gated by `churn_warning_ratio`.
