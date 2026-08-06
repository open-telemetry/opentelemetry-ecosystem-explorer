## Purpose

The purpose of this component is to monitor devices running a Redfish API which is quite often a BMC (Baseboard Management Controller) such as; Dell iDRAC, HPE iLO, etc.

## Prerequisites

This receiver supports Redfish versions:

- v1

## Configuration

These configuration options are for connecting to Redfish API servers.

The following settings are optional:

- `collection_interval`: (default = `60s`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `initial_delay` (default = `0s`): defines how long this receiver waits before starting.
- `servers`: The list of redfish servers to be monitored.

Each server has the following properties:
- `base_url` (required): base url to monitor in the form [https][://][host]:[port].
- `username` (required): Redfish username.
- `password` (required): Redfish password.
- `insecure` (optional, default: `false`): Sets the protocol security.
- `timeout` (optional, default: `60s`): Sets the Redfish client timeout.
- `redfish` (optional): Redfish configuration.
- `computer_system_id` (required): Redfish computer system id to monitor.
- `resources` (required): The list of Redfish resources to monitor.

The redfish configuration has the following properties:
- `version` (optional, default: `v1`): Redfish API version.

The redfish resource options include the below:
- ComputerSystem
- Chassis
- Fans
- Temperatures

### Example Configuration

```yaml
receivers:
  redfish:
    collection_interval: 60s
    servers:
    - base_url: https://16.1.15.1
      username: "${BMC_USER}"
      password: "${BMC_PASSWORD}"
      insecure: true
      computer_system_id: "1"
      redfish:
        version: v1
      resources:
      - ComputerSystem
      - Fans
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go).

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml)
