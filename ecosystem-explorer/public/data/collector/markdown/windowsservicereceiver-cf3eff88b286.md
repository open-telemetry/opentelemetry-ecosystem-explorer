## Getting Started

By default the Windows Service Receiver will attempt to identify and monitor the status of all specified services on the host machine.

An example of monitoring three services on a host:

```yaml
windows_service:
  collection_interval: <duration> # default = 1m
  include_services:
    - service1
    - service2
    - service3
    ...
```

The case where you wish to monitor all services present on a host machine, except for `service3`:

```yaml
windows_service:
  collection_interval: <duration> # default = 1m
  include_services:
  exclude_services:
    - service3
    ...
```
