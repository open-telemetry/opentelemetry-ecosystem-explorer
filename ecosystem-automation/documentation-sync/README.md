# Documentation Sync

Automation tool for synchronizing OpenTelemetry Collector component documentation with the ecosystem registry.

## Methodology

The tool updates the opentelemetry.io documentation site with the latest collector component tables from the ecosystem
registry.

Process:

* Clone or update the opentelemetry.io repository
* Load the latest release versions from the ecosystem registry
* Merge core and contrib component inventories
* Generate markdown tables for each component type (receivers, processors, exporters, connectors, extensions)
* Update documentation pages using marker-based content replacement

It reads versioned component metadata from `ecosystem-registry/collector` and updates tables in the opentelemetry.io
repository at `content/en/docs/collector/components/`.

## Configuration

### Environment Variables

You can specify a custom documentation repository location:

* `OTEL_DOCS_REPO_PATH` - Path to local opentelemetry.io repository

If not set, the repository will be automatically cloned to `tmp_repos/opentelemetry.io`.

## Usage

From the repository root:

```bash
# Clone/update docs repo and sync documentation
uv run documentation-sync

# Use existing clone without updating
uv run documentation-sync --no-update
```

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/documentation-sync/tests
```
