Serves as a placeholder receiver in a pipeline. This can be useful if you want
to e.g. start a Collector with only extensions enabled.

## Getting Started

All that is required to enable the No-op receiver is to include it in the
receiver definitions. It takes no configuration.

```yaml
receivers:
  nop:
```
