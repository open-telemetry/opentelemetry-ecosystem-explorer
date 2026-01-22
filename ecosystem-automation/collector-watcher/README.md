# Collector Watcher

Automation tool for watching and collecting OpenTelemetry Collector component metadata.

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/collector-watcher/tests

# Run the module
uv run python -m collector_watcher
```

## Adding Dependencies

```bash
uv add --package collector-watcher <package-name>
```