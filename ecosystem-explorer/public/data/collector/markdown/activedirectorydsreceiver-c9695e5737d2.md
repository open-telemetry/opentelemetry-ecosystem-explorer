## Configuration
The following settings are optional:
- `metrics` (default: see [`DefaultMetricsSettings`](./internal/metadata/generated_metrics.go)): Allows enabling and disabling specific metrics from being collected in this receiver.
- `collection_interval` (default = `10s`): The interval at which metrics are emitted by this receiver.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

Example:
```yaml
receivers:
  active_directory_ds:
    collection_interval: 10s
    metrics:
      # Disable the active_directory.ds.replication.network.io metric from being emitted
      active_directory.ds.replication.network.io:
        enabled: false
```

The full list of settings exposed for this receiver is documented in [config.go](./config.go), along with detailed sample configurations [here](./testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)
