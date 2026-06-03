# Explorer Database Builder

Automation tool for converting registry data into a content addressed database.

## Methodology

On a nightly basis, the tool regenerates data based on the latest registry entries. It runs three
pipelines — `javaagent`, `configuration`, and `collector` — each writing into its own directory
under `ecosystem-explorer/public/data/`.

The output file structure looks like:

```bash
ecosystem-explorer/
  public/
    data/
      javaagent/
        index.json                  # Lightweight index for javaagent (browsing/search)
        versions-index.json         # List of available javaagent versions
        global-configurations.json  # Aggregated, deduplicated config options across all versions
        versions/
          2.28.0-index.json         # Version manifest: {component-id: content-hash}
          ...
        instrumentations/
          aws-sdk-1.11/
            aws-sdk-1.11-48c8b39bee75.json
          ...
        markdown/
          aws-sdk-1.11/
            aws-sdk-1.11-48c8b39bee75.md    # Content-addressed READMEs
          ...
      configuration/
        versions-index.json         # List of available configuration schema versions
        versions/                    # Per-version schema manifests
        defaults/                    # Resolved default values
      collector/
        index.json                  # Lightweight index for collector components
        versions-index.json         # List of available collector versions
        versions/                    # Per-version manifests: {component-id: content-hash}
        components/                  # Content-addressed component data
          core-otlpreceiver/
            core-otlpreceiver-<hash>.json
          ...
```

## Usage

From the repository root:

```bash
# Build the database (incremental - reuses existing content-addressed files)
uv run explorer-db-builder

# Clean and rebuild the database from scratch
uv run explorer-db-builder --clean

# Build a single ecosystem pipeline (default: all)
uv run explorer-db-builder --ecosystem collector
```

`--ecosystem` accepts `javaagent`, `configuration`, `collector`, or `all` (the default). Nightly CI
passes this flag to rebuild a single ecosystem when only its registry data changed.

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/explorer-db-builder/tests --cov=explorer_db_builder
```
