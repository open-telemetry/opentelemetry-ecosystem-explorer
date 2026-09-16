## Prerequisites

Named pipes are only supported on Unix operating systems.

## Configuration

The following settings are required:

- `path`: The path to open the named pipe at.

The following settings are optional:

- `mode`: The mode bits to set on the opened pipe (default: 0666)

## Example Configuration

```yaml
receivers:
  named_pipe:
    path: /tmp/pipe
    mode: 0600
```

The deprecated component type `namedpipe` is still accepted:

```yaml
receivers:
  namedpipe:
    path: /tmp/pipe
    mode: 0600
```
