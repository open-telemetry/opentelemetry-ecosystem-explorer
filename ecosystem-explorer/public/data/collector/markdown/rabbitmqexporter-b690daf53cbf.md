Exports metrics, traces, and logs to [RabbitMQ](https://www.rabbitmq.com/) using the AMQP 0.9.1 protocol.

Messages are published to the [default exchange](https://www.rabbitmq.com/tutorials/amqp-concepts#exchange-default) direct exchange, but optionally can be published to a different direct exchange. 

This component expects that exchanges, queues, and bindings already exist - they are not currently created by this component.

## Getting Started

The following settings can be configured:
- `connection`:
  - `endpoint` (required, ex = amqp://localhost:5672): Endpoint to connect to RabbitMQ
  - `vhost` (optional): The RabbitMQ [virtual host](https://www.rabbitmq.com/docs/vhosts) to connect to
  - `auth`:
    - `plain`: Configuration if using SASL PLAIN authentication
      - `username` (required): username for authentication
      - `password`: password for authentication
  - `tls` (optional): [TLS configuration](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/configtls.go#L32)
  - `name` (optional): The name of the connection, visible in RabbitMQ management interface
- `routing`:
  - `routing_key` (default = otlp_spans for traces, otlp_metrics for metrics, otlp_logs for logs): Routing key used to route exported messages to RabbitMQ consumers
  - `exchange`: Name of the exchange used to route messages. If omitted, the [default exchange](https://www.rabbitmq.com/tutorials/amqp-concepts#exchange-default) is used which routes to a queue with the same as the routing key. Only [direct exchanges](https://www.rabbitmq.com/tutorials/amqp-concepts#exchange-direct) are currently supported. Note that this component does not handle queue creation or binding.
- `durable` (default = true): Whether to instruct RabbitMQ to make messages [durable](https://www.rabbitmq.com/docs/queues#durability) by writing to disk
- `encoding_extension`: (defaults to OTLP protobuf format): ID of the [encoding extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/encoding) to use to marshal data
- `retry_on_failure`:
  - `enabled` (default = false)

Example config:

```yaml
exporters:
  rabbitmq:
    connection:
      endpoint: amqp://localhost:5672
      auth:
        plain:
          username: user
          password: pass
    encoding_extension: otlp_encoding/rabbitmq

extensions:
  otlp_encoding/rabbitmq:
    protocol: otlp_json 
```
