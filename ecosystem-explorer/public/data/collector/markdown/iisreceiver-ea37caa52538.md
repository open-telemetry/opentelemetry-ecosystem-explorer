## Configuration

The following settings are optional:

- `collection_interval` (default = `10s`): The interval at which metrics should be emitted by this receiver.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

Example:

```yaml
    receivers:
      iis:
        collection_interval: 10s
        initial_delay: 1s

```

The full list of settings exposed for this receiver are documented in [config.go](./config.go).

## Metrics

Details about the metrics produced by this receiver can be found in [documentation.md](./documentation.md)
