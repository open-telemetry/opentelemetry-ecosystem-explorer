The memory limiter extension is used to prevent out of memory situations on
the collector. The extension will potentially replace the Memory Limiter Processor.
It provides better guarantees from running out of memory as it will be used by the
receivers to reject requests before converting them into OTLP. All the configurations
are the same as Memory Limiter Processor.

This extension can be used as an extension for all HTTP and gRPC receivers that
are configured through the standard `confighttp` and `configgrpc` libraries. For
example, to configure this extension in the OTLP receiver:

```
receivers:
  otlp:
    protocols:
      grpc:
        middlewares:
          - id: memory_limiter
      http:
        middlewares:
          - id: memory_limiter

extensions:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 15
```

`limit_percentage` and `spike_limit_percentage` are whole-number percentages
of the total memory, not fractions: `limit_percentage: 1` is one percent, and
a `spike_limit_percentage` of `0` leaves the spike limit at 20% of the limit.

otelcol_memorylimiter_refused_requests: Number of requests refused by the memory limiter extension (Attributes: transport="http" or transport="grpc").

Payloads refused by the extension never reach the receiver, so use `otelcol_memorylimiter_refused_requests` instead of `otelcol_receiver_refused_*` to track refused requests.

see [memorylimiterprocessor](../../processor/memorylimiterprocessor/README.md) for additional details
