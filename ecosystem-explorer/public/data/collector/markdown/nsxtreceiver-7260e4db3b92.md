> :construction: This receiver is in **ALPHA**. Configuration fields and metric data model are subject to change.

## Purpose

The purpose of this receiver is to allow users to monitor metrics from NSX-T environments.

## Prerequisites

Needs at least an “Auditor” user for NSX Manager Resources in the vSphere Client (can be created via Web UI or CLI)

The collector must be able to reach the NSX Manager with port 443 open.

This receiver supports NSX-T Datacenter versions:

- 3.2.0
- 3.1.2

## Configuration

- `endpoint`: Endpoint of the NSX Manager. Must be formatted as `{scheme}://{host}:{port}`. Schemes supported are `http` and `https`

- `username`: Username of the `Auditor` user

- `password`: Password of the `Auditor` user

- `collection_interval`: (default = `1m`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.

- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

- `timeout`: (default = `1m`) The timeout of running commands against the NSX REST API.

- `metrics` (default: see DefaultMetricsSettings [here])(./internal/metadata/generated_metrics.go): Allows enabling and disabling specific metrics from being collected in this receiver.

### Example Configuration

```yaml
receivers:
  nsxt:
    endpoint: https://nsx-manager
    username: admin
    password: password
    timeout: 60s
    metrics:
      nsxt.node.cpu.utilization:
        enabled: false

exporters:
  file:
    path: "./content.json"

service:
  pipelines:
    metrics:
      receivers: [nsxt]
      exporters: [file]
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)

