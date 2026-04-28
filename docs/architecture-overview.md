# System Architecture Overview

This system collects metadata about OpenTelemetry components (Java Agent instrumentations, Collector components)
and makes it searchable through a web app. Data flows from source repositories → automation scripts → versioned
registry → web application.

The OpenTelemetry Ecosystem Explorer is built as a three-component system comprising the
`ecosystem-automation`, `ecosystem-registry`, and `ecosystem-explorer` components. Each component has a distinct role in
collecting, storing, and presenting metadata about OpenTelemetry ecosystem components.

## Component Responsibilities

### ecosystem-automation

Automated pipelines that extract metadata from upstream OpenTelemetry projects.

**What it does**:

- Watches upstream projects for new releases
- Extracts and normalizes metadata to registry schema
- Generates content-addressed storage files for the web app

**Tools**: collector-watcher, java-instrumentation-watcher, configuration-watcher, explorer-db-builder

### ecosystem-registry

Versioned storage of normalized metadata.

**What it does**:

- Stores historical metadata for all versions
- Organized by ecosystem (Java Agent, Collector, etc.)

**Format**: YAML files organized by version

### ecosystem-explorer

React web app for browsing and exploring the registry.

**What it does**:

- Search, filter, and browse instrumentations and collector components
- View detailed metadata (supported signals, library versions, etc.)
- Compare versions

**Tech**: React 19, TypeScript, Vite, Tailwind CSS

## Data Flow

1. **Upstream Changes**: New release tagged in source repository
2. **Detection**: Watcher detects new version via GitHub API
3. **Extraction**: Watcher extracts metadata from specific tag
4. **Transformation**: Data normalized and content-addressed files generated
5. **Storage**: Data written to ecosystem-registry with version manifest
6. **Distribution**: Static files deployed to CDN
7. **Access**: Web app fetches data on-demand with caching
8. **Persistence**: Browser caches data in IndexedDB for offline use

## Key Design Decisions

### Content-Addressed Storage

**Why**: Efficiently handle multi-version data with minimal duplication

**Benefits**:

- Automatic deduplication across versions
- Immutable files enable aggressive caching
- Easy version comparison and change identification

See [Content-Addressed Storage](./content-addressed-storage.md) for implementation details.
