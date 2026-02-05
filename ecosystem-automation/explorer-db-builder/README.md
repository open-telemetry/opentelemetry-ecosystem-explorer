# Explorer Database Builder

Automation tool for converting registry data into a content addressed database.

## Methodology

On a nightly basis, the tool regenerates data based on the latest registry entries.

Process:

The output file structure looks like:

```bash
ecosystem-explorer/
  public/
    data/
      javaagent/
        index.json                  # Lightweight index for javaagent (browsing/search)
        versions-index.json         # List of available javaagent versions
        versions/
          2.24.0-index.json         # Version manifest: {component-id: content-hash}
          2.23.0-index.json
          ...
        instrumentations/
          akka-http-10.0/
            akka-http-10.0-737fb17f9652.json
          aws-sdk-1.11/
            aws-sdk-1.11-48c8b39bee75.json
          ...
        markdown/
          aws-sdk-1.11/
            aws-sdk-1.11-48c8b39bee75.md    # Content-addressed READMEs
          ...
```

## Usage

From the repository root:

```bash
# Build the database (incremental - reuses existing content-addressed files)
uv run explorer-db-builder

# Clean and rebuild the database from scratch
uv run explorer-db-builder --clean
```

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/explorer-db-builder/tests --cov=explorer_db_builder
```
