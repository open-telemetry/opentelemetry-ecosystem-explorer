## Getting Started

The settings are:

- `endpoint` (required, default = localhost:3500 for HTTP protocol, localhost:3600 gRPC protocol): host:port to which the receiver is going to receive data. See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.
- `use_incoming_timestamp` (optional, default = false) if set `true` the timestamp from Loki log entry is used

Example:
```yaml
receivers:
  loki:
    protocols:
      http:
        endpoint: 0.0.0.0:3500
      grpc:
        endpoint: 0.0.0.0:3600
    use_incoming_timestamp: true
```

## Advanced Configuration

Several helper files are leveraged to provide additional capabilities automatically:

- [gRPC settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configgrpc/README.md) including CORS
- [HTTP settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/confighttp/README.md)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
- [Auth settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configauth/README.md)
