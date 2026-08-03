## Overview

The OpenTelemetry Cgroup Auto-Config Extension is designed to optimize Go runtime performance in containerized environments by automatically configuring GOMAXPROCS and GOMEMLIMIT based on the Linux cgroup filesystem. This extension leverages [automaxprocs](https://github.com/uber-go/automaxprocs) or [gomaxecs](https://github.com/rdforte/gomaxecs) for AWS ECS Tasks and [automemlimit](https://github.com/KimMachineGun/automemlimit) packages to dynamically adjust Go runtime variables, ensuring efficient resource usage aligned with container limits.

## Configuration

The following settings can be configured:

- `gomaxprocs`: Configures the behavior of setting `GOMAXPROCS`, the maximum number of CPUs for Go runtime. Options:
  - `enabled`: A boolean value to enable or disable automatic configuration of `GOMAXPROCS` based on the system’s cgroup settings (default: true).

- `gomemlimit`: Configures the behavior of setting `GOMEMLIMIT`, the maximum memory limit for Go runtime. Options:
  - `enabled`: A boolean value to enable or disable automatic configuration of `GOMEMLIMIT` (default: true).
  - `ratio`: A floating-point value between 0 and 1 that represents the fraction of the detected memory limit to allocate for the Go runtime (default: 0.9).
  - `refresh_interval`: A duration value that enables periodic refresh of `GOMEMLIMIT` (default: `0s`, disabled).

## Examples

```yaml
extensions:
  # processor name: cgroupruntime
  cgroup_runtime:
    gomaxprocs:
      enabled: true
    gomemlimit:
      enabled: true
      ratio: 0.8
      refresh_interval: 30s
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to contribute to this extension.
