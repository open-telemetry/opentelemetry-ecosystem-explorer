# Configuration Watcher

Automation tool for watching and collecting OpenTelemetry configuration schema files.

## Methodology

On a nightly basis, the tool monitors the
[opentelemetry-configuration](https://github.com/open-telemetry/opentelemetry-configuration)
repository to detect new releases and pull the latest schema files.

Process:

* Clone or update a local copy of the opentelemetry-configuration repository.
* Copy all YAML schema files from the `schema/` directory.
* Create or update versioned snapshots in the `ecosystem-registry/configuration` directory.

You can pass in a location of the repository via the `OTEL_CONFIGURATION_PATH` environment variable,
or it will default to cloning into `tmp_repos/`.

## Usage

### Normal Sync Mode

From the repository root:

```bash
uv run configuration-watcher
```

This will:

* Process the latest release version (if not already tracked)
* Update the SNAPSHOT version from the main branch
* Skip versions that already exist in the inventory

### Backfill Mode

Regenerate existing versions in the inventory:

```bash
# Backfill all versions
uv run configuration-watcher --backfill

# Backfill specific versions
uv run configuration-watcher --backfill --versions "1.0.0,0.4.0"
```

### Options

* `--backfill` - Enable backfill mode (regenerates existing versions)
* `--versions VERSION_LIST` - Comma-separated list of versions (e.g., "1.0.0,0.4.0")
* `--inventory-dir PATH` - Custom path to inventory directory (default: ecosystem-registry/configuration)

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/configuration-watcher/tests --cov=configuration_watcher
```
