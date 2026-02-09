# Content-Addressed Storage

Raw registry data is transformed into individual JSON files named by content hash, enabling
automatic deduplication and efficient caching.

## Purpose

Transform raw registry data to optimize for:

- **Fast Web Access**: Small individual files load faster than large aggregated files
- **Efficient Caching**: Immutable content-addressed files can be cached indefinitely
- **Automatic Deduplication**: Identical content across versions shares the same file
- **Version Comparison**: Easy to identify what changed by comparing content hashes

## Output Structure

```text
ecosystem-explorer/public/data/
├── javaagent/
│   ├── versions-index.json                    # List of available versions
│   ├── versions/
│   │   ├── 2.24.0-index.json                  # Version manifest (ID → hash)
│   │   └── 2.23.0-index.json
│   └── instrumentations/
│       ├── aws-sdk-2.2/
│       │   └── aws-sdk-2.2-cc07cd659de1.json  # Content-addressed file
│       ├── spring-boot-3.0/
│       │   └── spring-boot-3.0-8f9a2b3c4d5e.json
│       └── ...
└── collector/
    └── ... (similar structure)
```

## Content Addressing

### Hash Computation

**Process**:

1. Normalize JSON (sorted keys, no whitespace)
2. Compute SHA-256 hash of normalized content
3. Truncate to first 12 characters
4. Use as filename suffix

### Immutability Guarantee

Hash in filename guarantees immutable content:

- Enables aggressive CDN caching: `Cache-Control: public, max-age=31536000, immutable`
- No cache invalidation needed
- Same hash = identical content

## Key Files

### Versions Index

**Location**: `{ecosystem}/versions-index.json`

**Purpose**: List all available versions

**Example** (`javaagent/versions-index.json`):

```json
{
  "versions": [
    {
      "version": "2.24.0",
      "is_latest": true
    },
    {
      "version": "2.23.0",
      "is_latest": false
    }
  ]
}
```

Caching: Short TTL (updates when new versions added) - or perhaps we can add a random hash to the filename to make it
immutable as well? Then we can just update the file with the new hash when a new version is added, and set a long TTL.
This would eliminate the need for cache invalidation entirely. We would just need to ensure that the web application
always fetches the latest versions index before fetching any version manifests.

### Version Manifest

**Location**: `{ecosystem}/versions/{version}-index.json`

**Purpose**: Map component IDs to content hashes for this version

**Example** (`javaagent/versions/2.24.0-index.json`):

```json
{
  "version": "2.24.0",
  "instrumentations": {
    "aws-sdk-2.2": "cc07cd659de1",
    "spring-boot-3.0": "8f9a2b3c4d5e",
    "http-url-connection": "bc83dcd98c80"
  }
}
```

Caching: Long TTL (doesn't change after version release)

### Component Data Files

**Location**: `{ecosystem}/{component-type}/{id}/{id}-{hash}.json`

**Purpose**: Full metadata for a single component

**Example** (`javaagent/instrumentations/aws-sdk-2.2/aws-sdk-2.2-cc07cd659de1.json`):

```json
{
  "name": "aws-sdk-2.2",
  "display_name": "AWS SDK 2.2",
  "description": "Instrumentation for AWS SDK 2.2+ client library",
  "scope": {
    "name": "io.opentelemetry.aws-sdk-2.2"
  },
  "telemetry": [
    {
      "when": "default",
      "spans": [
        {
          "span_kind": "CLIENT",
          "attributes": [
            {
              "name": "aws.request_id",
              "type": "STRING"
            }
          ]
        }
      ]
    }
  ]
}
```

Caching: Immutable (cache forever)

## Data Loading Patterns

**Initial Load**:

1. Fetch `versions-index.json` and determine latest version
2. Fetch `versions/{version}-index.json`
3. Display component list

**Component Detail**:

1. Look up hash in manifest: `"aws-sdk-2.2": "cc07cd659de1"`
2. Fetch `instrumentations/aws-sdk-2.2/aws-sdk-2.2-cc07cd659de1.json`
3. Display component details
