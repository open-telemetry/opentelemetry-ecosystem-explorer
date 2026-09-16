This receiver was donated by SignalFx and ported from SignalFx's Gateway
(https://github.com/signalfx/gateway/tree/master/protocol/collectd). As a
result, this receiver supports some additional features that are technically
not compatible with stock CollectD's write_http plugin. That said, in
practice such incompatibilities should never surface. For example, this
receiver supports extracting labels from different fields. Given a field
value `field[a=b, k=v]`, this receiver will extract `a` and `b` as label keys
and, `k` and `v` as the respective label values.

## Configuration
The configuration includes the OpenTelemetry collector's server [confighttp](https://github.com/open-telemetry/opentelemetry-collector/tree/main/config/confighttp#server-configuration),
which allows for a variety of settings. Only the most relevant ones will be discussed here, but all are available.

The following settings are required:

- `endpoint` (default = `localhost:8081`): Endpoint exposed by this receiver to send data.

The following settings are optional:

- `attributes_prefix` (no default): Used to add query parameters in key=value format to all metrics.
- `timeout` (default = `30s`): Used as the `read_timeout` and `write_timeout` for the listening server.

Example:

```yaml
receivers:
  collectd:
  collectd/one:
    attributes_prefix: "dap_"
    endpoint: "localhost:12345"
    timeout: "50s"
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

