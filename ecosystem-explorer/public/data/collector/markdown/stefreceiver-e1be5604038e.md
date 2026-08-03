For more about OTel/STEF, see [STEF exporter docs](../../exporter/stefexporter/README.md).

## Configuration

- `endpoint` (default = localhost:4320 for grpc protocol):
  host:port on which the receiver is going to receive data. Refer to
  [naming documentation](https://github.com/grpc/grpc/blob/master/doc/naming.md)
  for valid syntax for host part.
- `ack_interval` (default: 10ms). The periodical interval of time when sending acknowledgements back to the client.

Example:

```yaml
stef:
  endpoint: 0.0.0.0:4320
```

OTel/STEF is a compact and fast telemetry format.

STEF receiver supports the following advanced settings:

- [gRPC settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configgrpc/README.md)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)