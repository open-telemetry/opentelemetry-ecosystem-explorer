The `otlp_http` exporter sends logs, metrics, profiles and traces via HTTP using [OTLP](
https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md)
format.

The `otlphttp` deprecated alias exists for the component name. It will be removed in a future version.
If you use the deprecated alias `otlphttp` in your configuration, change it to `otlp_http`.

The following settings are required:

- `endpoint` (no default): The target base URL to send data to (e.g.: https://example.com:4318).
  To send each signal a corresponding path will be added to this base URL, i.e. for traces
  "/v1/traces" will appended, for metrics "/v1/metrics" will be appended, for logs
  "/v1/logs" will be appended.

The following settings can be optionally configured:

- `traces_endpoint` (no default): The target URL to send trace data to (e.g.: https://example.com:4318/v1/traces).
   If this setting is present the `endpoint` setting is ignored for traces.
- `metrics_endpoint` (no default): The target URL to send metric data to (e.g.: https://example.com:4318/v1/metrics).
   If this setting is present the `endpoint` setting is ignored for metrics.
- `logs_endpoint` (no default): The target URL to send log data to (e.g.: https://example.com:4318/v1/logs).
- `profiles_endpoint` (no default): The target URL to send profile data to (e.g.: https://example.com:4318/v1development/profiles).
   If this setting is present the `endpoint` setting is ignored for logs.
- `tls`: see [TLS Configuration Settings](../../config/configtls/README.md) for the full set of available options.
- `timeout` (default = 30s): HTTP request time limit. For details see https://golang.org/pkg/net/http/#Client
- `read_buffer_size` (default = 0): ReadBufferSize for HTTP client.
- `write_buffer_size` (default = 512 * 1024): WriteBufferSize for HTTP client.
- `encoding` (default = proto): The encoding to use for the messages (valid options: `proto`, `json`)
- `retry_on_failure`:  see [Retry on Failure](../exporterhelper/README.md#retry-on-failure) for the full set of available options.
- `sending_queue`: see [Sending Queue](../exporterhelper/README.md#sending-queue) for the full set of available options.

Example:

```yaml
exporters:
  otlp_http:
    endpoint: https://example.com:4318
```

By default `gzip` compression is enabled. See [compression comparison](../../config/configgrpc/README.md#compression-comparison) for details benchmark information. To disable, configure as follows:

```yaml
exporters:
  otlp_http:
    ...
    compression: none
```

By default `proto` encoding is used, to change the content encoding of the message configure it as follows:

```yaml
exporters:
  otlp_http:
    ...
    encoding: json
```

The full list of settings exposed for this exporter are documented [here](./config.go)
with detailed sample configurations [here](./testdata/config.yaml).
