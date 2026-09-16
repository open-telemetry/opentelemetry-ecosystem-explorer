## Configuration

``` yaml
processors:
    delta_to_cumulative:
        # how long until a series not receiving new samples is removed
        [ max_stale: <duration> | default = 5m ]
 
        # upper limit of streams to track. new streams exceeding this limit
        # will be dropped
        [ max_streams: <int> | default = 9223372036854775807 (max int) ]

```

There is no further configuration required. All delta samples are converted to cumulative.

## Troubleshooting

When [Telemetry is
enabled](https://opentelemetry.io/docs/collector/configuration/#telemetry), this component exports [several metrics](./documentation.md). 
