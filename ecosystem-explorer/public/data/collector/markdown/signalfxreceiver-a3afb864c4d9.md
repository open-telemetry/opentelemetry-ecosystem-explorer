The SignalFx receiver accepts:

- Metrics in the [SignalFx proto
format](https://github.com/signalfx/com_signalfx_metrics_protobuf).
- Events (Logs) in the [SignalFx proto
format](https://github.com/signalfx/com_signalfx_metrics_protobuf/blob/master/proto/signalfx_metrics.proto#L137).
More information about sending custom events can be found in the [SignalFx
Developers
Guide](https://dev.splunk.com/observability/reference/api/ingest_data/latest).

## Configuration

The following settings are required:

- `endpoint` (default = `localhost:9943`): Address and port that the SignalFx
  receiver should bind to.
  See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.

The following settings are optional:

- `tls_settings` (no default): This is an optional object used to specify if
  TLS should be used for incoming connections. Both `key_file` and `cert_file`
  are required to support incoming TLS connections.
    - `cert_file`: Specifies the certificate file to use for TLS connection.
    - `key_file`: Specifies the key file to use for TLS connection.

Example:

```yaml
receivers:
  signalfx:
  signalfx/advanced:
    tls:
      cert_file: /test.crt
      key_file: /test.key
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

> :warning: When enabling the SignalFx receiver or exporter, configure both the `metrics` and `logs` pipelines.

```yaml
service:
  pipelines:
    metrics:
      receivers: [signalfx]
      processors: [memory_limiter]
      exporters: [signalfx]
    logs:
      receivers: [signalfx]
      processors: [memory_limiter]
      exporters: [signalfx]
```
## Access token passthrough

Access token passthrough is no longer supported, to achieve similar behavior configure your collector
to use the `headers_setter` extension to pass the access token. 
