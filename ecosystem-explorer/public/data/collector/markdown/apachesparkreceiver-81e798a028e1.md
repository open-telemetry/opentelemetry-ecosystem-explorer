## Purpose

The purpose of this component is to monitor Apache Spark clusters and the applications running on them through the collection of performance metrics like memory utilization, CPU utilization, shuffle operations, garbage collection time, I/O operations, and more.

## Prerequisites

This receiver supports Apache Spark versions:

- 3.3.2+

## Configuration

> **Note:** This receiver was renamed from `apachespark` to `apache_spark` to match the snake_case naming convention.
> The deprecated component type `apachespark` is still accepted as an alias and will log a deprecation warning.

These configuration options are for connecting to an Apache Spark application.

The following settings are optional:

- `collection_interval`: (default = `60s`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.
- `endpoint`: (default = `http://localhost:4040`): Apache Spark endpoint to connect to in the form of `[http][://]{host}[:{port}]`
- `application_names`: An array of Spark application names for which metrics should be collected. If no application names are specified, metrics will be collected for all Spark applications running on the cluster at the specified endpoint.

### Example Configuration

```yaml
receivers:
  apache_spark:
    collection_interval: 60s
    endpoint: http://localhost:4040
    application_names:
    - PythonStatusAPIDemo
    - PythonLR
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)
