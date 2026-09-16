The Faro exporter sends telemetry data to a [Faro](https://grafana.com/oss/faro/) endpoint.

## Configuration

The following settings are required:

- `endpoint` (no default): The URL to send telemetry data to (e.g., https://faro.example.com/collect).

The following settings can be optionally configured:

- `sending_queue`
  - `enabled` (default = true)
  - `num_consumers` (default = 10)
  - `queue_size` (default = 1000)
- `retry_on_failure`
  - `enabled` (default = true)
  - `initial_interval` (default = 5s): Time to wait after the first failure before retrying.
  - `max_interval` (default = 30s): Upper bound on backoff.
  - `max_elapsed_time` (default = 300s): Maximum amount of time spent trying to send a batch.
- `timeout` (default = 5s): HTTP request timeout when sending data.
- `read_buffer_size` (default = 0): Size of the buffer used to read the response body.
- `write_buffer_size` (default = 512 KiB): Size of the buffer used to write the request body.
- `headers` (default = `{}`): Additional headers to send with the request.
- `compression` (default = none): Compression method to use for the request body. Supported values: `none`, `gzip`.

Example:

```yaml
exporters:
  faro:
    endpoint: https://faro.example.com/collect
    timeout: 10s
    headers:
      X-API-Key: "my-api-key"
```

The full list of settings exposed for this exporter are documented [here](./config.go) with detailed sample configurations [here](./testdata/config.yaml).

## Getting Started

The following settings are required:

- `endpoint` (no default): URL to which the exporter is going to send Faro telemetry data. For example: `https://faro.example.com/collect`.

To use TLS, specify `https://` as the protocol scheme in the URL passed to the `endpoint` property.
See [Advanced Configuration](#advanced-configuration) for more TLS options.

Example:

```yaml
exporters:
  faro:
    endpoint: "https://faro.example.com/collect"

  faro/tlsnoverify:
    endpoint: "https://faro.example.com/collect"
    tls:
      insecure_skip_verify: true
```

## Propagating the `X-Faro-Session-Id` header

If using the faro exporter component to send telemetry data to the Grafana Cloud Collector Endpoint for [Frontend Observability](https://grafana.com/products/cloud/frontend-observability/), make sure to propagate the `X-Faro-Session-Id` header.

Grafana Cloud's Faro collector validates the session at the HTTP level and rejects requests that do
not carry an `X-Faro-Session-Id` header (HTTP 400, `missing X-Faro-Session-Id header`). The Faro Web
SDK sends this header on every request to the [Faro receiver][faroreceiver], but the exporter does
not forward incoming request headers automatically.

To propagate the session id from the incoming request onto the outgoing export, use the
[headers_setter extension][headerssetter] with `from_context`, and set `include_metadata: true` on
the receiver so the header is available to the pipeline:

```yaml
receivers:
  faro:
    include_metadata: true
    cors:
      allowed_origins:
        - '*'
      allowed_headers:
        - 'X-Faro-Session-Id'
        - 'Content-Type'

extensions:
  headers_setter:
    headers:
      - action: insert
        key: X-Faro-Session-Id
        from_context: X-Faro-Session-Id

exporters:
  faro:
    endpoint: 'https://faro-collector-<region>.grafana.net/collect/<app-key>'
    auth:
      authenticator: headers_setter

service:
  extensions: [headers_setter]
  pipelines:
    traces:
      receivers: [faro]
      exporters: [faro]
    logs:
      receivers: [faro]
      exporters: [faro]
```

If a [batch processor][batchprocessor] is present in the pipeline, add `X-Faro-Session-Id` to its
`metadata_keys` so the metadata is preserved through batching.

When using [Grafana Alloy][alloy], the equivalent is the [`otelcol.auth.headers`][alloyauthheaders]
component with `from_context = "X-Faro-Session-Id"` and `include_metadata = true` on
`otelcol.receiver.faro`.

For a complete preprocessing example (including PII redaction and event filtering), see the Grafana
Cloud [Process Faro telemetry][processfaro] documentation.

[faroreceiver]: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/faroreceiver
[headerssetter]: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/headerssetterextension
[batchprocessor]: https://github.com/open-telemetry/opentelemetry-collector/tree/main/processor/batchprocessor#batching-and-client-metadata
[alloy]: https://grafana.com/docs/alloy/latest/
[alloyauthheaders]: https://grafana.com/docs/alloy/latest/reference/components/otelcol/otelcol.auth.headers/
[processfaro]: https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/frontend-observability/configure/process-faro-telemetry/

## Advanced Configuration

Several helper files are leveraged to provide additional capabilities automatically:

- [HTTP client settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/confighttp/README.md#client-configuration)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
- [Queuing, retry and timeout settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md) 
