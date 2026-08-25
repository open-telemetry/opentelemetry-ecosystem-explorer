## Configuration

The following configuration settings are available:

- `targets` (required): The list of targets to be pinged.
- `collection_interval` (optional, default = `60s`): This receiver collects metrics on an interval. Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `initial_delay` (optional, default = `1s`): Defines how long this receiver waits before starting.

### Target Configuration

Each target has the following properties:

- `host` (required): A hostname or IP address to be pinged.
- `ping_count` (optional, default = `3`): The number of packets after which the pinger is stopped.
- `ping_interval` (optional, default = `1s`): The wait time between each packet send. 
- `ping_timeout` (optional, default = `5s`): Specifies a timeout before ping exits, regardless of how many packets have been received.

### Optional Metrics Configuration

Each metric can be enabled or disabled individually. By default, all metrics are enabled. Example:

```yaml
receivers:
  icmpcheck:
    metrics:
      ping.rtt.min:
        enabled: false
```

## Metrics

Details about the metrics produced by this receiver can be found in [documentation.md](./documentation.md)

## Resource Attributes

The following attributes are added to all reported resources:

- `net.peer.ip` - the IP address of the host being pinged.
- `net.peer.name` - the string address of the host being pinged.

## Example Configuration

```yaml
receivers:
  icmpcheck:
    collection_interval: 30s
    metrics:
      ping.rtt.min:
        enabled: false
    targets:
      - host: "https://opentelemtry.io"
        ping_count: 4
      - host: "192.168.101.25"
        ping_interval: 2s
        ping_timeout: 3s
processors:
  batch:
    send_batch_max_size: 1000
    send_batch_size: 100
    timeout: 10s
exporters:
  debug:
    verbosity: detailed
service:
  pipelines:
    metrics:
      receivers: [ icmpcheck ]
      processors: [ batch ]
      exporters: [ debug ]
```
