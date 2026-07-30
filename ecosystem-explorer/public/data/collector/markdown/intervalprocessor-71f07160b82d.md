## Description

The interval processor (`intervalprocessor`) aggregates metrics and periodically forwards the latest values to the next component in the pipeline. The processor supports aggregating the following metric types:

* Monotonically increasing, cumulative sums
* Monotonically increasing, cumulative histograms
* Monotonically increasing, cumulative exponential histograms
* Gauges 
* Summaries

The following metric types will *not* be aggregated, and will instead be passed, unchanged, to the next component in the pipeline:

* All delta metrics
* Non-monotonically increasing sums

> NOTE: Aggregating data over an interval is an inherently "lossy" process. For monotonically increasing, cumulative sums, histograms, and exponential histograms, you "lose" precision, but you don't lose overall data. But for non-monotonically increasing sums, gauges, and summaries, aggregation represents actual data loss. IE you could "lose" that a value increased and then decreased back to the original value. In most cases, this data "loss" is ok. However, if you would rather these values be passed through, and *not* aggregated, you can set that in the configuration

## Configuration

The following settings can be optionally configured:

```yaml
interval:
  # The interval in which the processor should export the aggregated metrics. 
  [ interval: <duration> | default = 60s ]
  
  pass_through:
    # Whether gauges should be aggregated or passed through to the next component as they are
    [ gauge: <bool> | default = false ]
    # Whether summaries should be aggregated or passed through to the next component as they are
    [ summary: <boo>l | default = false ]
```

## Example of metric flows

The following sum metrics come into the processor to be handled

| Timestamp | Metric Name  | Aggregation Temporality | Attributes        | Value |
| --------- | ------------ | ----------------------- | ----------------- | ----: |
| 0         | test_metric  | Cumulative              | labelA: foo       |   4.0 |
| 2         | test_metric  | Cumulative              | labelA: bar       |   3.1 |
| 4         | other_metric | Delta                   | fruitType: orange |  77.4 |
| 6         | test_metric  | Cumulative              | labelA: foo       |   8.2 |
| 8         | test_metric  | Cumulative              | labelA: foo       |  12.8 |
| 10        | test_metric  | Cumulative              | labelA: bar       |   6.4 |

The processor would immediately pass the following metrics to the next processor in the chain

| Timestamp | Metric Name  | Aggregation Temporality | Attributes        | Value |
| --------- | ------------ | ----------------------- | ----------------- | ----: |
| 4         | other_metric | Delta                   | fruitType: orange |  77.4 |

Because it's a Delta metric.

At the next `interval` (15s by default), the processor would pass the following metrics to the next processor in the chain

| Timestamp | Metric Name | Aggregation Temporality | Attributes  | Value |
| --------- | ----------- | ----------------------- | ----------- | ----: |
| 8         | test_metric | Cumulative              | labelA: foo |  12.8 |
| 10        | test_metric | Cumulative              | labelA: bar |   6.4 |

> [!IMPORTANT]
> After exporting, any internal state is cleared. So if no new metrics come in, the next interval will export nothing.
