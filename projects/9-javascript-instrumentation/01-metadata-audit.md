---
title: "Metadata Audit - JavaScript Instrumentation"
issue: 9
type: audit
phase: 1
status: in-progress
last_updated: "2026-05-17"
---

Analysis of the `opentelemetry-js-contrib` repository at HEAD `8fe14a9`(2026-05-08). All findings
are from actual file contents.

## Repository overview

- 47 directories matching `instrumentation-*` under `packages/`
- 46 active `package.json` files
- 1 deprecated directory (`instrumentation-redis-4`) - README only, no `package.json`

## What is machine-readable today

Every active `package.json` has:

| Field                  | Source                                    | Notes                            |
| ---------------------- | ----------------------------------------- | -------------------------------- |
| `name`                 | `package.json`                            | npm package name                 |
| `version`              | `package.json`                            | Independent per package          |
| `description`          | `package.json`                            | Consistently worded              |
| `engines.node`         | `package.json`                            | Structured Node.js version range |
| `repository.directory` | `package.json`                            | Present in 44/46 packages        |
| `homepage`             | `package.json`                            | Links to package subdirectory    |
| `component_owners`     | `.github/component_owners.yml`            | Per package path, 46 entries     |
| `bundle_membership`    | `auto-instrumentations-node/package.json` | Recoverable from dep list        |
| `package_version`      | `.release-please-manifest.json`           | Per package                      |

## What exists but is inconsistent

### Supported versions

- 41/47 READMEs have a `### Supported Versions` heading
- 6 packages have no supported versions heading: browser-navigation, document-load, long-task,
  redis-4, user-interaction, web-exception
- `.tav.yml` exists for 31/47 packages with tested version ranges
- README and `.tav.yml` don't always agree - Express README says `>=4.0.0 <6` but `.tav.yml` tests
  `>=4.16.2 <6`

### Telemetry data

All 47 READMEs mention telemetry somewhere but only **8/47** have any structured span or attribute
section under a dedicated heading:

- `instrumentation-aws-sdk`
- `instrumentation-cassandra-driver`
- `instrumentation-dataloader`
- `instrumentation-hapi`
- `instrumentation-kafkajs`
- `instrumentation-nestjs-core`
- `instrumentation-pg`
- `instrumentation-web-exception`

The remaining 39 packages reference telemetry in prose only, no structured tables or lists that can
be parsed reliably.

#### Heading inconsistency

No standard heading exists across the 8 that do have structured data:

| Heading used               | Count |
| -------------------------- | ----- |
| `## Span Attributes`       | 1     |
| `## Emitted Spans`         | 1     |
| `## Semantic Attributes`   | 1     |
| `### Spans Emitted`        | 1     |
| `### Spans created`        | 1     |
| `### Span Types Created`   | 1     |
| `### Attributes Collected` | 1     |
| `### Attributes collected` | 1     |

The best example is `instrumentation-aws-sdk` which has a proper markdown table with attribute
names, types, descriptions, and examples. Most others use bullet lists or prose.

### Configuration options

- 29/47 READMEs have an Options/Configuration section
- Format varies - markdown tables, bullet lists, prose
- Types often reference TypeScript interfaces rather than primitives

### Semantic conventions

- 41/47 READMEs mention semantic conventions
- Usually as a version string or a link - not structured data

## What is missing entirely

- Stability level - not tracked in any structured field
- Log telemetry - some packages emit logs (e.g. browser-navigation) but there is no structured field
  for this anywhere
- Unmaintained status - recorded as a YAML comment in `component_owners.yml`, not a field

## Proposed registry schema

Based on what is machine-readable today, a Phase 1 registry entry would look like this:

```yaml
name: instrumentation-express
npm_package: "@opentelemetry/instrumentation-express"
version: "0.66.0"
description: "OpenTelemetry instrumentation for `express` http web application framework"
source_path: packages/instrumentation-express
repository: open-telemetry/opentelemetry-js-contrib
node_engine: "^18.19.0 || >=20.6.0"
in_auto_instrumentations_node: true
component_owners:
  - JamieDanielson
  - pkanal
  - raphael-theriault-swi
supported_versions:
  - package: express
    version_range: ">=4.0.0 <6"
    source: README.md
tested_versions:
  - package: express
    range: ">=4.16.2 <6"
    mode: latest-minors
    source: .tav.yml
```

## What requires upstream work

For full parity with the Java instrumentation schema, the following would need to be added upstream
in js-contrib:

1. **Structured telemetry data** - spans, metrics, attributes per instrumentation. Only 8/47
   packages have any structured data today, and none use a consistent format. A standardized heading
   convention or a `metadata.yaml` file per package would be needed.

2. **Stability level** - currently undocumented in structured form.

3. **Log telemetry** - the current Java schema has no `logs` field. JS packages that emit logs would
   need a schema extension.

4. **Configuration options** - 29/47 have some documentation but formats are inconsistent and types
   reference TypeScript interfaces.

## Versioning model

JS packages version independently, there is no single "js agent version" to key the registry off.
The registry layout should be per package:

```text
ecosystem-registry/javascript/instrumentation-express/v0.66.0/instrumentation.yaml
ecosystem-registry/javascript/instrumentation-mongoose/v0.64.0/instrumentation.yaml
```
