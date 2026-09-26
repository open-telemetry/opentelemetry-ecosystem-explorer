# Explorer Database Builder

Automation tool for converting registry data into a content addressed database.

## Methodology

On a nightly basis, the tool regenerates data based on the latest registry entries. It runs three
pipelines — `javaagent`, `configuration`, and `collector` — each writing into its own directory
under `ecosystem-explorer/public/data/`.

Those three directories are owned **entirely** by this tool. A `--clean` build `rmtree`s each one
before rebuilding, so any hand-maintained file placed inside them is deleted without warning — this
is what silently removed the curated `javaagent/announcements.json` in #882. Curated content that
the frontend fetches must live in a sibling directory the builder never writes to. Today those are
`public/data/announcements/`, `public/data/defaults/` and `public/data/activity/` (a v1 stub that a
generated feed is expected to replace).

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
      collector/
        index.json                  # Lightweight index for collector components
        deprecations-index.json     # Removed components pointing to their last-version data
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

# Also write one reproducible archive per ecosystem, plus archive-plan.json
uv run explorer-db-builder --clean --emit-archives ./archives
```

`--ecosystem` accepts `javaagent`, `configuration`, `collector`, or `all` (the default). The nightly
workflow always builds every ecosystem from clean, because incremental mode reads back its own
previous output and cannot notice that a file it wrote earlier no longer hashes to its own name.

`--emit-archives DIR` requires `--ecosystem all`, because the plan it writes describes every
ecosystem and a single-pipeline build would pin digests for trees it did not produce. It packs each
ecosystem directory into a byte-reproducible `DIR/<ecosystem>.tar.gz` and writes
`DIR/archive-plan.json` beside them, recording each ecosystem's content digest, the release tag that
digest implies, the asset name, and whether it differs from the digest pinned in
`ecosystem-explorer/public/data-manifest.json`. That digest comparison is what lets the workflow
skip republishing unchanged data; the archive bytes play no part in it. The archives are
byte-reproducible for a different reason, so that rebuilding the same registry state does not churn
an already published asset.

The manifest itself is written separately, once a release exists, because it records the published
asset's checksum rather than the bytes a given run happened to compress:

```bash
uv run python -m explorer_db_builder.data_manifest \
  --ecosystem collector --release-tag data-collector-<digest> \
  --content-digest <64 hex> --archive-sha256 <64 hex> --registry-commit <sha>
```

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/explorer-db-builder/tests --cov=explorer_db_builder
```
