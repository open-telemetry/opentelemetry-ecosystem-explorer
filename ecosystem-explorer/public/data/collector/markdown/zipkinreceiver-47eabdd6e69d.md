## Getting Started

All that is required to enable the Zipkin receiver is to include it in the
receiver definitions.

```yaml
receivers:
  zipkin:
```

The following settings are configurable:

- `endpoint` (default = localhost:9411): host:port on which the receiver is going to receive data.See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.  You can review the [full list of `ServerConfig`](https://github.com/open-telemetry/opentelemetry-collector/tree/main/config/confighttp).
- `parse_string_tags` (default = false): if enabled, the receiver will attempt to parse string tags/binary annotations into int/bool/float.

## Advanced Configuration

Several helper files are leveraged to provide additional capabilities automatically:

- [HTTP server settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/confighttp/README.md#server-configuration) including CORS
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
