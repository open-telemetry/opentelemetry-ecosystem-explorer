## Configuration

- `endpoint`: (default = `pool.ntp.org:123`) Endpoint of the NTP server. Must be formatted as `{host}:{port}`. 

- `collection_interval`: (default = `30m`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.

- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

- `metrics` (default: see DefaultMetricsSettings [here](./internal/metadata/generated_metrics.go)): Allows enabling and disabling specific metrics from being collected in this receiver.

### Example Configuration

```yaml
receivers:
  ntp:
    endpoint: pool.ntp.org:123
    collection_interval: 1h
    initial_delay: 5m
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./internal/metadata/testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)

