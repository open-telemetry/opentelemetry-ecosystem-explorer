The extension requires read and write access to a Redis cluster.

## Config
- `endpoint` (required): The endpoint of the redis instance to connect to. Default: `localhost:6379`
- `password` (optional): The password to connect to the redis instance. Default: ``
- `db` (optional): Database to be selected after connecting to the server. Default: 0
- `expiration` (optional): TTL for all storage entries. Default TTL means the key has no expiration time. Default: 0
- `prefix` (optional): The prefix used for the redis key. If specified, it will be appended to the default as follows: `_<prefix>`. Default: `<component_kind>_<component_type>_<component_name>_<storage_extension_name>`.
- `tls`:
  - `insecure` (default = false): whether to disable client transport security for the exporter's connection.
  - `ca_file`: path to the CA cert. For a client this verifies the server certificate. Should only be used if `insecure` is set to false.
  - `cert_file`: path to the TLS cert to use for TLS required connections. Should only be used if `insecure` is set to false.
  - `key_file`: path to the TLS key to use for TLS required connections. Should only be used if `insecure` is set to false.

## Example

```yaml
extensions:
  redis_storage:
  redis_storage/all_settings:
    endpoint: localhost:6379
    password: ""
    db: 0
    expiration: 5m
    prefix: test_
    tls:
      insecure: true

service:
  extensions: [redis_storage, redis_storage/all_settings]
  pipelines:
    traces:
      receivers: [nop]
      exporters: [nop]

# Data pipeline is required to load the config.
receivers:
  nop:
exporters:
  nop:
```
