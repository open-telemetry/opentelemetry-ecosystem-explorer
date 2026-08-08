## Configuration

The following settings are required:

- `endpoint` (default: `localhost:11211`): The hostname/IP address and port or, unix socket file path of the memcached instance
- `transport` (default: no default): Known protocols are "tcp", "tcp4" (IPv4-only), "tcp6"
  (IPv6-only), "udp", "udp4" (IPv4-only), "udp6" (IPv6-only), "ip", "ip4"
  (IPv4-only), "ip6" (IPv6-only), "unix", "unixgram" and "unixpacket".

The following settings are optional:

- `collection_interval` (default = `10s`): This receiver runs on an interval.
Each time it runs, it queries memcached, creates metrics, and sends them to the
next consumer. The `collection_interval` configuration option tells this
receiver the duration between runs. This value must be a string readable by
Golang's `ParseDuration` function (example: `1h30m`). Valid time units are
`ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.
- `tls`: configures the TLS settings used to connect to memcached. TLS is
disabled by default (`insecure: true`), preserving plaintext connections. See
[TLS Configuration Settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
for the full set of supported options.

Example:

```yaml
receivers:
  memcached:
    endpoint: "localhost:11211"
    collection_interval: 10s
    transport: tcp
```

Example with TLS enabled:

```yaml
receivers:
  memcached:
    endpoint: "localhost:11211"
    tls:
      insecure: false
      ca_file: /etc/ssl/certs/ca.crt
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml) with further documentation in [documentation.md](./documentation.md)

