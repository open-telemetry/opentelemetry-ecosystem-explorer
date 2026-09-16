Envoy ALS (Access Log Service) is a feature of Envoy Proxy that allows for the
centralized collection and management of access logs.

Instead of writing access logs to local files, Envoy can be configured to send these logs to a remote gRPC service.

This is particularly useful in distributed systems where centralized logging is required for monitoring, auditing, and debugging purposes.

[Istio](https://istio.io) and [Envoy Gateway](https://gateway.envoyproxy.io) support OTLP and gRPC ALS with first class API.

## Getting Started

> **Note:** This receiver was renamed from `envoyals` to `envoy_als` to match the snake_case naming convention.
> The deprecated component type `envoyals` is still accepted as an alias and will log a deprecation warning.

The settings are:

- `endpoint` (required, default = localhost:19001 gRPC protocol): host:port to which the receiver is going to receive data. See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.

Example:
```yaml
receivers:
  envoy_als:
    endpoint: 0.0.0.0:3500
```

## Advanced Configuration

Other options can be configured to support more advanced use cases:

- [gRPC settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configgrpc/README.md) including CORS
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)

