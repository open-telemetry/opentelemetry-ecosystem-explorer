# Watchers and Registry Consumers

Automation components in `ecosystem-automation` that handle the pipeline between source
projects and the registry. Run as scheduled GitHub Actions or event-triggered workflows.

## Watchers

Watchers monitor upstream OpenTelemetry projects and extract metadata when changes occur.

### Core Responsibilities

Every watcher must fulfill five critical functions:

#### 1. Version Management

* **Detect releases**: Monitor GitHub for new version tags via API, trigger extraction pipeline
* **Generate versioned inventory**: Extract metadata from specific Git tags, store with version identifier
* **Maintain snapshots** (optional): Extract from `main` branch, mark as SNAPSHOT (e.g., `v2.25.1-SNAPSHOT`), update nightly

#### 2. Schema Evolution

* **Source schema changes**: Detect metadata structure changes, implement parsers for multiple versions,
  map to current registry schema
* **Registry schema changes**: Transform source data to match latest schema, maintain backward
  compatibility, document migrations
* **Virtual versioning**: When source lacks schema versions, detect structural changes and infer schema
  version from field presence

#### 3. Change Detection

* **Schema changes**: Compare extractions, identify field changes, create GitHub issues automatically
* **Data quality**: Validate required fields and types, flag anomalies for review

#### 4. Data Regeneration

* **Backfill historical versions**: Iterate through Git tags, extract metadata, generate versioned inventory
* **Regenerate on demand**: Manual trigger for schema migrations or bug fixes via workflow dispatch

#### 5. Deterministic Output

* **Consistent ordering**: Sort arrays deterministically, use stable JSON serialization
* **Reproducible transformations**: Avoid random elements, use deterministic hashing, no timestamps in content

## Registry Consumers

### explorer-db-builder

Converts raw registry data into content-addressed database for the web application.

**Process**:

1. Reads latest registry data (YAML metadata files)
2. Generates content-addressed JSON files (named by SHA-256 hash)
3. Creates version manifests mapping component IDs to content hashes
4. Outputs to `ecosystem-explorer/public/data/`

Runs nightly via GitHub Actions to rebuild database when registry updates.
