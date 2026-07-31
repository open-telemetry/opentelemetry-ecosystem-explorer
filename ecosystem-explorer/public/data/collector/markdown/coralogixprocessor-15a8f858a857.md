## Configuration

- `transactions`:
  - `enabled` (`false` by default): enables the transactions feature from the Coralogix processor (more information below).

## Features

### Transactions

A **transaction** represents one logical unit of work in a service — a sequence of function and method calls triggered by an event (like an HTTP request). The Transactions feature (originally called "Service Flows") is Coralogix's extension of OpenTelemetry instrumentation that breaks down each transaction into segments and aggregates their performance over time. It provides visibility into how each segment within a service contributes to overall transaction performance.

More information in the [official docs](https://coralogix.com/docs/user-guides/apm/features/transactions).

#### How It Works

The processor automatically identifies the transaction root span within each transaction and applies transaction attributes to all spans in that transaction:

1. **Transaction root Identification**: The processor finds the span with no parent span ID (or whose parent is not in the current trace) and marks it as the transaction root.
2. **Transaction attributes**: All spans in the transaction trace receive the following attributes:
    - `cgx.transaction`: Set to the name of the transaction root span
    - `cgx.transaction.root`: Set to `true` for the root span only

#### Configuration

**Note**: The transactions feature requires the `groupbytrace` processor to be configured before the `coralogix` processor in your pipeline to work properly. This ensures that all spans from the same trace are processed together.

```yaml
config:
  processors:
    groupbytrace:
      wait_duration: 5s
      num_traces: 1000
    coralogix:
      transactions:
        enabled: true
  service:
    pipelines:
      traces:
        processors: 
          - groupbytrace
          - coralogix
```
