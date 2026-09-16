## Configuration

> **Note:** This receiver was renamed from `tcpcheck` to `tcp_check` to match the snake_case naming convention.
> The deprecated component type `tcpcheck` is still accepted as an alias and will log a deprecation warning.

The following settings are required:
- `endpoint`

The following settings are optional:

- `collection_interval` (default = `60s`): This receiver collects metrics on an interval. Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.

## Example Configuration

Targets are

```yaml
receivers:
  tcp_check:
    targets:
      - endpoint: example.com:443
        dialer:
          timeout: 15s
      - endpoint: foobar.com:8080
        dialer:
          timeout: 15s
      - endpoint: localhost:10901
```
The full list of settings exposed for this receiver are documented [here](./config.go) with detailed sample configurations [here](./testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)

