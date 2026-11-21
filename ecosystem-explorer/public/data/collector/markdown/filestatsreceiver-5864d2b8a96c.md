## Configuration

> **Note:** This receiver was renamed from `filestats` to `file_stats` to match the snake_case naming convention.
> The deprecated component type `filestats` is still accepted as an alias and will log a deprecation warning.

- `include` (required): The glob path for files to watch
- `collection_interval` (default = `1m`): The interval at which metrics are emitted by this receiver.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

### Example

```
receivers:
  file_stats:
    include: /tmp/files/*
    collection_interval: 10s
    initial_delay: 1s
```

See [documentation.md](./documentation.md) for a list of the metrics collected.
