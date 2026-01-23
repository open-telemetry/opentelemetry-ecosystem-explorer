# Collector Watcher

Automation tool for watching and collecting OpenTelemetry Collector component metadata.

## Methodology

On a nightly basis, the tool scans the OpenTelemetry Collector core and contrib repositories to detect any changes in
component metadata.

Process:
* Clone or update local copies of the `core` and `contrib` collector repositories.
* Scan for components and parse their `metadata.yaml` files.
* Create or update versioned snapshots of component metadata in YAML format.

You can pass in a location of the repositories to scan via environment variables or else it will default to cloning
them into `tmp_repos/`.

It maintains a versioned `inventory` of component snapshots in YAML format in the `ecosystem-registry/collector` directory.

## Configuration

### Environment Variables

You can specify custom repository locations using environment variables:

- `OTEL_COLLECTOR_CORE_PATH` - Path to local opentelemetry-collector-core repository
- `OTEL_COLLECTOR_CONTRIB_PATH` - Path to local opentelemetry-collector-contrib repository

If not set, repositories will be automatically cloned to `tmp_repos/`.

## Usage

From the repository root:

```bash
uv run collector-watcher
```

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/collector-watcher/tests

# Run tests with coverage
uv run pytest ecosystem-automation/collector-watcher/tests --cov=collector_watcher

# Run the module
uv run python -m collector_watcher
```

## Adding Dependencies

```bash
uv add --package collector-watcher <package-name>
```
