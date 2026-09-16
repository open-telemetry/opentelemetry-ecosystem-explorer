## Prerequisites

This receiver supports CouchDB versions `2.3+` and `3.1+`.

## Configuration

The following settings are required:

- `username`
- `password`

The following settings are optional:

- `endpoint` (default: `http://localhost:5984`): The URL of the CouchDB endpoint

- `collection_interval` (default = `60s`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.

### Example Configuration

```yaml
receivers:
  couchdb:
    endpoint: http://localhost:5984
    username: otelu
    password: ${env:COUCHDB_PASSWORD}
    collection_interval: 60s
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml). TLS config is documented further under the [opentelemetry collector's configtls package](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)

