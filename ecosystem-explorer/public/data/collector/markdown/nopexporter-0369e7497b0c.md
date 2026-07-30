Serves as a placeholder exporter in a pipeline. This can be useful if you want
to e.g. start a Collector with only extensions enabled, or for testing Collector
pipeline throughput without worrying about an exporter.

## Getting Started

All that is required to enable the No-op exporter is to include it in the
exporter definitions. It takes no configuration.

```yaml
exporters:
  nop: {} # Explicitly set in case the config is re-serialized (e.g. with the Operator)
```
