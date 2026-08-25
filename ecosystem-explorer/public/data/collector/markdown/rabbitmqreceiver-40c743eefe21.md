## Prerequisites

This receiver supports RabbitMQ versions `3.8` and `3.9`.

The RabbitMQ Management Plugin must be enabled by following the [official instructions](https://www.rabbitmq.com/management.html#getting-started).

Also, a user with at least [monitoring](https://www.rabbitmq.com/management.html#permissions) level permissions must be used for monitoring.

## Configuration

The following settings are required:
- `username`
- `password`

The following settings are optional:

- `endpoint` (default: `http://localhost:15672`): The URL of the node to be monitored.
- `collection_interval` (default = `10s`): This receiver collects metrics on an interval. Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.
- `tls`: TLS control. [By default, insecure settings are rejected and certificate verification is on](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).

### Example Configuration

```yaml
receivers:
  rabbitmq:
    endpoint: http://localhost:15672
    username: otelu
    password: ${env:RABBITMQ_PASSWORD}
    collection_interval: 10s
    metrics:  # Enable node metrics by explicitly setting them to true
      rabbitmq.node.disk_free:
        enabled: true
      rabbitmq.node.disk_free_limit:
        enabled: true
      rabbitmq.node.disk_free_alarm:
        enabled: true
      rabbitmq.node.mem_used:
        enabled: true
      rabbitmq.node.mem_limit:
        enabled: true
      rabbitmq.node.mem_alarm:
        enabled: true
      rabbitmq.node.fd_used:
        enabled: true
      rabbitmq.node.fd_total:
        enabled: true
      rabbitmq.node.sockets_used:
        enabled: true
      rabbitmq.node.sockets_total:
        enabled: true
      rabbitmq.node.proc_used:
        enabled: true
      rabbitmq.node.proc_total:
        enabled: true
      rabbitmq.node.disk_free_details.rate:
        enabled: true
      rabbitmq.node.fd_used_details.rate:
        enabled: true
      rabbitmq.node.mem_used_details.rate:
        enabled: true
      rabbitmq.node.proc_used_details.rate:
        enabled: true
      rabbitmq.node.sockets_used_details.rate:
        enabled: true
      # Enable exchange metrics by explicitly setting them to true
      rabbitmq.exchange.messages.published_in:
        enabled: true
      rabbitmq.exchange.messages.published_out:
        enabled: true
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml). TLS config is documented further under the [opentelemetry collector's configtls package](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md).

## Metrics

This receiver collects RabbitMQ queue-level metrics from the `/api/queues` endpoint (enabled by default), and node-level and exchange-level metrics from the `/api/nodes` and `/api/exchanges` endpoints (disabled by default). Metrics are categorized into the following groups:

- **Memory usage**: `rabbitmq.node.mem_used`, `rabbitmq.node.mem_limit`, `rabbitmq.node.mem_alarm`
- **Disk space**: `rabbitmq.node.disk_free`, `rabbitmq.node.disk_free_limit`, `rabbitmq.node.disk_free_alarm`
- **File descriptors & sockets**: `rabbitmq.node.fd_used`, `rabbitmq.node.sockets_used`, etc.
- **Process & scheduling**: `rabbitmq.node.proc_used`, `rabbitmq.node.run_queue`, `rabbitmq.node.context_switches`
- **Garbage collection & I/O**: `rabbitmq.node.gc.num`, `rabbitmq.node.io_read_avg_time`, etc.
- **Cluster & node metadata**: `rabbitmq.node.uptime`, `rabbitmq.node.processors`, etc.
- **Exchange throughput**: `rabbitmq.exchange.messages.published_in`, `rabbitmq.exchange.messages.published_out`

Details about the metrics produced by this receiver and full list of supported metrics can be found in [metadata.yaml](./metadata.yaml)