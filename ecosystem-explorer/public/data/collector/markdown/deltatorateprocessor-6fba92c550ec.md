**Status: under development; Not recommended for production usage.**

## Configuration

Configuration is specified through a list of metrics. The processor uses metric names to identify a set of delta sum metrics and calculates the rates which are gauges.

```yaml
processors:
    # processor name: delta_to_rate
    delta_to_rate:

        # list the delta sum metrics to calculate the rate. This is a required field.
        metrics:
            - <metric_1_name>
            - <metric_2_name>
            .
            .
            - <metric_n_name>
```

[development]: https://github.com/open-telemetry/opentelemetry-collector#development
[contrib]:https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
