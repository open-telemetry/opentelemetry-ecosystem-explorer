Riak metrics will be collected from the [/stats](https://docs.riak.com/riak/kv/2.2.3/developing/api/http/status) endpoint.

This Riak receiver will collect metrics for [3.x+](https://github.com/basho/riak/releases)

## Configuration

The following configuration settings are required:

- `username`
- `password`

The following configuration settings are optional:

- `endpoint` (default: `http://localhost:8098`): The URL of the node to be monitored.
- `collection_interval` (default = `60s`): This receiver collects metrics on an interval. Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.
- `tls`: TLS control. [By default, insecure settings are rejected and certificate verification is on](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).

### Example Configuration

```yaml
receivers:
  riak:
    endpoint: http://localhost:8098
    username: otelu
    password: ${env:RIAK_PASSWORD}
    collection_interval: 60s
```

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)


