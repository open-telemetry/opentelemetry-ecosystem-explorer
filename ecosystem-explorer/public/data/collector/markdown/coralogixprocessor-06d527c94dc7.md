## Configuration

- `transactions`:
  - `enabled` (`false` by default): enables the transactions feature from the Coralogix processor (more information below).
- `critical_path`:
  - `enabled` (`false` by default): enables critical path calculation for complete traces (more information below).

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

### Critical path

The critical path feature computes the end-to-end latency path for each complete trace and annotates spans with Coralogix attributes that can be used in the UI and downstream queries.

The computed critical path is a best-effort result derived from span timing and parent-child structure. It should be treated as a heuristic view of latency contribution, especially for traces with ambiguous causality or malformed timestamps.

#### Attributes

- `cgx.critical_path.is_on_path`: Set to `true` when any portion of the span lies on the critical path.
- `cgx.critical_path.exclusive_duration_ns`: Critical path wall time, in nanoseconds, owned directly by the span.
- `cgx.critical_path.inclusive_duration_ns`: Total critical path wall time, in nanoseconds, attributable to the span, including descendants on the path.

#### Configuration

**Note**: The critical path feature requires the `groupbytrace` processor to run before the `coralogix` processor in the pipeline so the full trace is available in memory.

```yaml
config:
  processors:
    groupbytrace: {}
    coralogix:
      critical_path:
        enabled: true
  service:
    pipelines:
      traces:
        processors:
          - groupbytrace
          - coralogix
```

#### Algorithm References

- [Uber CRISP repository](https://github.com/uber-research/CRISP)
