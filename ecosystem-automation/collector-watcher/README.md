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

* `OTEL_COLLECTOR_CORE_PATH` - Path to local opentelemetry-collector-core repository
* `OTEL_COLLECTOR_CONTRIB_PATH` - Path to local opentelemetry-collector-contrib repository

If not set, repositories will be automatically cloned to `tmp_repos/`.

## Usage

### Normal Sync Mode

From the repository root:

```bash
uv run collector-watcher
```

This will:

* Process the latest release version for each distribution (if not already tracked)
* Update the SNAPSHOT version from the main branch
* Skip versions that already exist in the inventory

### Backfill Mode

Backfill mode allows you to regenerate existing versions in the inventory. This is useful when:

* Scanner logic changes (e.g., new component exclusions)
* Metadata parsing improvements are made
* You need to apply updates to historical data

#### Backfill All Versions

Regenerate all existing versions for all distributions:

```bash
uv run collector-watcher --backfill
```

#### Backfill Specific Distribution

Regenerate all versions for a single distribution:

```bash
uv run collector-watcher --backfill --distribution contrib
```

#### Backfill Specific Versions

Regenerate specific versions for a distribution:

```bash
uv run collector-watcher --backfill --distribution contrib --versions "0.144.0,0.145.0"
```

Apply a version list to all distributions:

```bash
uv run collector-watcher --backfill --versions "0.144.0,0.145.0"
```

#### Options

* `--backfill` - Enable backfill mode (regenerates existing versions)
* `--distribution {core,contrib}` - Target a specific distribution
* `--versions VERSION_LIST` - Comma-separated list of versions (e.g., "0.144.0,0.145.0")
* `--inventory-dir PATH` - Custom path to inventory directory (default: ecosystem-registry/collector)

**Note:** Backfill mode will delete and regenerate the specified versions. The tool automatically checks out the correct
git tags for each version.

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/collector-watcher/tests --cov=collector_watcher
```
