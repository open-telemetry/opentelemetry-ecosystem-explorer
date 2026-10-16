Export data via gRPC using [OTLP](
https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md)
format. By default, this exporter requires TLS and offers queued retry capabilities.

## Getting Started

The following settings are required:

- `endpoint` (no default): host:port to which the exporter is going to send OTLP trace data,
using the gRPC protocol. The valid syntax is described
[here](https://github.com/grpc/grpc/blob/master/doc/naming.md).
If a scheme of `https` is used then client transport security is enabled and overrides the `insecure` setting.
- `tls`: see [TLS Configuration Settings](../../config/configtls/README.md) for the full set of available options.
- `retry_on_failure`:  see [Retry on Failure](../exporterhelper/README.md#retry-on-failure) for the full set of available options.
- `sending_queue`: see [Sending Queue](../exporterhelper/README.md#sending-queue) for the full set of available options.
- `timeout` (default = 5s): Time to wait per individual attempt to send data to a backend.

Example:

```yaml
exporters:
  otlp_grpc:
    endpoint: otelcol2:4317
    tls:
      cert_file: file.cert
      key_file: file.key
  otlp/2:
    endpoint: otelcol2:4317
    tls:
      insecure: true
```

By default, `gzip` compression is enabled. See [compression comparison](../../config/configgrpc/README.md#compression-comparison) for details benchmark information. To disable, configure as follows:

```yaml
exporters:
  otlp_grpc:
    ...
    compression: none
```

## Profiles Development Version

The Profiles exporter sends exactly one `otlp-profiles-development-version`
metadata value, using
[`pprofileotlp.DevelopmentVersion`](../../pdata/pprofile/pprofileotlp/version.go)
to identify its compiled-in schema. Any configured value for this metadata key
is overridden. The exporter does not forward incoming version metadata or
negotiate a different version.
See the [receiver documentation](../../receiver/otlpreceiver/README.md#profiles-development-version)
for the protocol and compatibility considerations.

## Advanced Configuration

Several helper files are leveraged to provide additional capabilities automatically:

- [gRPC settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configgrpc/README.md)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
- [Queuing, batching, retry and timeout settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md)
