# System Architecture Overview

The OpenTelemetry Ecosystem Explorer is built as a three-component system comprising the
`ecosystem-automation`, `ecosystem-registry`, and `ecosystem-explorer` components. Each component has a distinct role in
collecting, storing, and presenting metadata about OpenTelemetry ecosystem components.

## Component Responsibilities

### ecosystem-automation

Automated data collection and transformation pipelines,
run via github actions and scheduled workflows.

**Scope**:

- Watch upstream projects for releases and changes
- Extract and normalize metadata to registry schema
- Generate content-addressed storage files
- Synchronize with opentelemetry.io documentation

### ecosystem-registry

Versioned, normalized metadata storage

**Scope**:

- Store historical metadata for all versions
- Support multiple ecosystems (Java Agent, Collector, etc.)

### ecosystem-explorer

User-facing web application (React + TypeScript + Vite) for browsing and exploring metadata

**Scope**:

- Browse, search, and filter instrumentations and collector components
- View detailed telemetry information
- Compare versions

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

### Static Site Approach

**Why**: Eliminates operational overhead of running servers and databases

**Benefits**:

- Low maintenance and operational overhead
- High reliability and performance via CDN
- Low cost

**Tradeoffs**:

- Updates require rebuild/redeploy
- No server-side processing
- Client-side computation only

### Content-Addressed Storage

**Why**: Efficiently handle multi-version data with minimal duplication

**Benefits**:

- Automatic deduplication across versions
- Immutable files enable aggressive caching
- Easy version comparison and change identification

See [Content-Addressed Storage](./content-addressed-storage.md) for implementation details.
