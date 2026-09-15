# `otelc` Registry Architecture

This document outlines the registry layout for the Go compile-time instrumentation (`otelc`) CLI.

## Overview

`otelc` consumes a **single, signed JSON artifact per repository release**. This enables offline
caching, fast batch-loading, and cryptographic verification (Cosign/Sigstore) of the instrumentation
metadata required to automatically inject OpenTelemetry at compile time.

## Output Structure

The otelc-specific registry tree is generated at:

```text
ecosystem-explorer/public/data/otelc/v1/
├── catalog.json                       # Master list of releases
└── releases/
    ├── registry-<registry_hash>.json      # Single file with all instrumentations for a release
    └── registry-<registry_hash>.json.sig  # Cosign/Sigstore signature
```

### 1. `catalog.json`

Lists all available releases grouped by repository. Excludes `-SNAPSHOT` builds. Each release
reports the highest (strictest) `go_min_version` and `otelc_min_version` across all its
instrumentations, allowing the CLI to gracefully select the newest registry release compatible with
its own version for each repository independently. If a release has no minimum version constraint,
these fields may be empty strings (`""`).

**Caching:** Served with a short TTL (e.g., `Cache-Control: public, max-age=60`) so clients quickly
observe new releases.

```json
{
  "schema_version": 1,
  "repositories": [
    {
      "name": "opentelemetry-go-compile-instrumentation",
      "releases": [
        {
          "version": "v0.3.0",
          "registry_hash": "a1b2c3d4e5f6",
          "is_latest": true,
          "min_otelc_version": "v0.2.0",
          "min_go_version": "1.22"
        }
      ]
    }
  ]
}
```

### 2. `registry-<registry_hash>.json`

The consolidated metadata for a specific repository's release. Contains an array of
instrumentations.

**Caching:** Immutable content-addressed file, cached indefinitely
(`Cache-Control: public, max-age=31536000, immutable`).

**Included Fields:** `name`, `target_module`, `modules`, `go_min_version`, `otelc_min_version`.
_(Note: `target_module` is optional; if omitted, it indicates the instrumentation should always be
applied unconditionally. `display_name`, `description`, and `stability` are also included to support
future `otelc` CLI search and inspection commands)._

**Filtering:** The builder only includes instrumentations where `installation.methods` contains
`"automatic"`.

```json
{
  "schema_version": 1,
  "registry_hash": "a1b2c3d4e5f6",
  "instrumentations": [
    {
      "name": "instrumentation-net-http-otelhttp",
      "display_name": "net/http",
      "description": "Instrumentation for net/http",
      "target_module": "net/http",
      "modules": [
        {
          "path": "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp",
          "version": "v0.60.0"
        }
      ],
      "go_min_version": "1.22",
      "otelc_min_version": "v0.1.0",
      "stability": "stable"
    }
  ]
}
```

## Hash Computation and Immutability

The `registry_hash` identifies the exact contents of a registry payload. The hash is computed over
the payload structure **excluding the `registry_hash` field itself** (i.e.
`{"schema_version": <int>, "instrumentations": [...]}`):

1. **Normalization:** The JSON structure (without `registry_hash`) is normalized with sorted keys
   recursively and minified separators (no unnecessary whitespace, i.e., `separators=(',', ':')`).
2. **Hashing:** A SHA-256 digest of the normalized UTF-8 string is computed.
3. **Truncation:** The first 12 characters of the hex digest become the `registry_hash`.

Because the hash is baked directly into the filename (`registry-<registry_hash>.json`), the content
is guaranteed to be immutable. If upstream repositories release identical `automatic`
instrumentations across two different versions, the computed hash remains identical, effectively
deduplicating the release state.

### Re-verification by CLI / Consumers

To verify the integrity of a downloaded `registry-<registry_hash>.json` file:

1. Parse the JSON file into memory.
2. Remove the `registry_hash` field from the dictionary.
3. Normalize the JSON (sorted keys, minified `separators=(',', ':')`, UTF-8).
4. Compute the SHA-256 digest and truncate to the first 12 characters.
5. Verify that this matches the `registry_hash` in the filename and envelope.

## `otelc` Consumption Workflow

1. **Resolve Release Hashes:** `otelc` fetches `catalog.json`. For each repository, it selects the
   latest compatible release based on its `min_otelc_version` and extracts the `<registry_hash>`.
2. **Check Cache:** If the `registry-<registry_hash>.json` files are already in the local cache
   (`~/.cache/otelc/`), proceed.
3. **Download & Verify:** For any missing hashes, download `registry-<registry_hash>.json` and
   `.sig`. Verify the artifacts using Sigstore. If any fail, delete them and abort.
4. **Execute:** Scan the local project's `go.mod`. Match dependencies against the `target_module`
   fields across all trusted registry files in memory to determine what to inject (instrumentations
   lacking a `target_module` are applied unconditionally).

## Implementation Details

1. **Independent Repositories:** Upstream OpenTelemetry Go repositories release on different
   schedules. `catalog.json` treats them as completely independent repositories. `otelc` determines
   which payload to pull for each repo.
2. **Schema Evolution and Deprecation:** To ensure backwards compatibility when breaking changes are
   introduced to the registry schema, the registry is hosted under a versioned URL path
   (`/otelc/v1/`).
   - **Additive Changes:** Adding new, optional fields does _not_ bump the schema version. `otelc`
     must silently ignore fields it does not recognize.
   - **Breaking Changes:** Renaming fields, changing data types, or changing core semantics in
     _either_ the catalog or the registry files bumps the unified `SCHEMA_VERSION` (e.g., to `2`).
     The backend builder will then output to a new directory entirely (`/otelc/v2/`).
   - **Deprecation Period:** When a new schema version is released, the old directory (e.g., `v1/`)
     is frozen. It will remain on the CDN for a grace period (e.g., 12 months) so older `otelc`
     binaries continue to fetch their old `catalog.json` and function without interruption, though
     they will not receive new instrumentations.
   - **CLI Behavior (404 Not Found):** After the deprecation grace period ends, the old schema
     directory is physically deleted from the CDN. If the `otelc` CLI receives a `404 Not Found`
     error when attempting to fetch its `catalog.json`, it must handle it gracefully by aborting
     with an explicit error: _"Registry not found. Your otelc version might be too old, please
     upgrade to the latest version."_
