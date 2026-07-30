## Prerequisites

This receiver supports Apache Flink versions `1.13.6` and `1.14.4`.

By default, authentication is not required. However, [Flink recommends](https://nightlies.apache.org/flink/flink-docs-master/docs/deployment/security/security-ssl/#external--rest-connectivity) using a “side car proxy” that Binds the REST endpoint to the loopback interface and to start a REST proxy that authenticates and forwards the request to Flink.

[SSL](https://nightlies.apache.org/flink/flink-docs-master/docs/deployment/security/security-ssl/#external--rest-connectivity) can be enabled with the following REST endpoint [options](https://nightlies.apache.org/flink/flink-docs-master/docs/deployment/security/security-ssl/#rest-endpoints-external-connectivity) for external connectivity and have a self signed certificate or be self signed.

## Configuration

The following settings are optional:

- `endpoint` (default: `http://localhost:15672`): The URL of the node to be monitored.
- `collection_interval` (default = `10s`): This receiver collects metrics on an interval. Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `tls`: TLS control. [By default, insecure settings are rejected and certificate verification is on](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

### Example Configuration

> **Note:** The receiver type has been renamed from `flinkmetrics` to `flink_metrics`. The old name is still accepted but will log a deprecation warning.

```yaml
receivers:
  flink_metrics:
    endpoint: http://localhost:8081
    collection_interval: 10s
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml). TLS config is documented further under the [opentelemetry collector's configtls package](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)

