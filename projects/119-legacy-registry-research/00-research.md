---
title: "Research — V1 vs V2 Registry: Collector Component Coverage and Metadata"
issue: 119
type: audit
phase: 1
status: in-progress
last_updated: "2026-05-11"
---

## Overview

This document captures the research findings for
[issue #119](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/119). It
compares the V1 registry (opentelemetry.io/data/registry) and the V2 registry
(ecosystem-explorer/ecosystem-registry) focusing on collector components, their coverage, their
metadata, and the automation that maintains each.

---

## Registry Definitions

| Name | Location | Purpose |
| ---- | -------- | ------- |
| **V1 registry** ("otel io registry") | [opentelemetry.io/data/registry](https://github.com/open-telemetry/opentelemetry.io/tree/main/data/registry) | Flat YAML files, one per component, used to power the registry section of opentelemetry.io and to inject component versions into docs via Hugo shortcodes. |
| **V2 registry** ("explorer registry") | [ecosystem-explorer/ecosystem-registry](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/tree/main/ecosystem-registry) | Version-stamped YAML files per release, richer metadata sourced from component metadata.yaml files in the collector repos, used to power the Ecosystem Explorer website. |

---

## Component Coverage

### V2 Registry (latest: v0.151.0)

Components tracked per distribution and type:

**Contrib distribution**

| Type       | Count |
| ---------- | ----- |
| receiver   | 113   |
| exporter   | 48    |
| processor  | 31    |
| extension  | 43    |
| connector  | 14    |
| **Total**  | **249** |

**Core distribution** is also tracked separately and includes the standard set of components
bundled with the collector core (otlp receiver/exporter, batch processor, etc.).

### V1 Registry (as of May 2026)

Based on the registry contents at opentelemetry.io/data/registry filtered to
`language: collector`:

| Type       | Count |
| ---------- | ----- |
| receiver   | 120   |
| exporter   | 60    |
| processor  | 32    |
| extension  | 48    |
| connector  | 14    |
| **Total**  | **274** |

### Coverage Gap

V1 has more entries than V2 in most categories. The key reasons are:

1. V1 includes components from third-party distributions (not just core and contrib). Some
   exporters and extensions in V1 point to external repositories outside the
   opentelemetry-collector-contrib repo.
2. V2 currently only tracks core and contrib distributions.
3. V1 was built up manually over time; some entries may represent components that have since been
   removed or renamed in contrib, creating stale entries.

---

## Metadata Fields Comparison

### V1 Registry Fields

Each V1 entry is a single YAML file with these fields:

| Field          | Required | Description |
| -------------- | -------- | ----------- |
| `title`        | yes      | Human-readable display name |
| `registryType` | yes      | Component type: receiver, exporter, processor, connector, extension |
| `language`     | yes      | Set to `collector` for all collector components |
| `tags`         | yes      | Array: typically includes `go`, the component type, and `collector` |
| `license`      | yes      | License (e.g., Apache 2.0) |
| `description`  | yes      | Short description of what the component does |
| `authors`      | yes      | Array of objects with `name` field |
| `urls.repo`    | yes      | URL to the component source repository |
| `createdAt`    | yes      | ISO date when the entry was created |
| `package.registry` | yes  | Package registry type (e.g., `go-collector`) |
| `package.name` | yes      | Full Go module path |
| `package.version` | yes   | Current version, updated by automation |

### V2 Registry Fields

V2 entries are stored inside versioned YAML files (one file per component type per version). Each
component entry includes:

| Field                | Required | Description |
| -------------------- | -------- | ----------- |
| `name`               | yes      | Component identifier (e.g., `activedirectorydsreceiver`) |
| `metadata.type`      | yes      | Short type name (e.g., `active_directory_ds`) |
| `metadata.display_name` | no    | Human-readable name |
| `metadata.description` | no     | Description |
| `metadata.status.class` | yes   | receiver, processor, exporter, connector, extension |
| `metadata.status.stability` | yes | Per-signal stability: development, alpha, beta, stable, deprecated, unmaintained |
| `metadata.status.distributions` | no | Which distributions include this component |
| `metadata.status.codeowners.active` | no | GitHub handles of active maintainers |
| `metadata.status.codeowners.emeritus` | no | GitHub handles of emeritus maintainers |
| `metadata.status.unsupported_platforms` | no | Platforms where component does not work |
| `metadata.attributes` | no      | Attribute definitions emitted by this component |
| `metadata.metrics`   | no       | Metric definitions emitted by this component |
| `metadata.config`    | no       | JSON Schema definition of the component configuration |
| `metadata.resource_attributes` | no | Resource attribute definitions |

### Field Gap Analysis

Fields in V1 that V2 does NOT track:

| V1 Field     | Notes |
| ------------ | ----- |
| `license`    | V2 does not track license per component. Could be sourced from GitHub API (license field on the repo) or inferred since all contrib components are Apache 2.0. |
| `authors`    | V2 has `codeowners` which is a closer modern equivalent but is not the same as authors. |
| `tags`       | V2 has no tag system. V1 uses tags like `go`, `collector`, `receiver` for filtering on opentelemetry.io. |
| `createdAt`  | V2 does not track when a component was first registered. |
| `urls.repo`  | V2 does not store an explicit repository URL per component, though the source location is derivable from the Go module path. |

Fields in V2 that V1 does NOT track:

| V2 Field                  | Notes |
| ------------------------- | ----- |
| `stability` (per signal)  | V1 has no stability level. Users of V1 cannot distinguish alpha from stable components. |
| `distributions`           | V1 does not record which distributions bundle each component. |
| `codeowners`              | V1 does not track maintainers per component. |
| `attributes` and `metrics` | V1 has no telemetry schema. V2 is the only source for this data. |
| `config` schema           | V1 has no configuration schema. |
| `unsupported_platforms`   | V1 does not record platform restrictions. |

---

## How V1 is Maintained

Based on the comment from @svrnm (an OpenTelemetry maintainer) in the issue:

- **Version updates are automated**: There are scripts that update the `package.version` field in
  V1 entries periodically.
- **URL health checks run manually**: Every few months a script checks whether URLs in V1 entries
  are still valid.
- **Everything else is manual**: New component entries are added by hand when someone notices they
  are missing. There is no automated detection of new components being added to contrib.
- **No audit trail**: There is no formal process to detect when a component is removed from contrib
  and its V1 entry becomes stale.

---

## How V1 is Used

1. **opentelemetry.io registry page**: The `/ecosystem/registry/` section of the website is
   generated from V1 registry YAML files.
2. **Hugo shortcodes**: A macro allows documentation pages to embed the current version of a
   component by referencing its package name. The version comes from `package.version` in V1.
3. **collector-sync automation**: A Python tool at
   `opentelemetry.io/scripts/collector-sync` reads from V2 registry data to update V1 registry
   entries, primarily the version field.

---

## How collector-sync Works

The collector-sync script is a Python project at `scripts/collector-sync/` in the opentelemetry.io
repo. At a high level:

1. It pulls collector component metadata from the V2 registry (ecosystem-explorer).
2. It matches V2 components to existing V1 registry entries by package name.
3. It updates the `package.version` field in the matched V1 entries.
4. Changes are submitted as a pull request for review.

The key implication: **V2 is already the source of truth for version data in V1**. The link
between the two registries exists today, but only for version updates.

---

## Summary of Key Findings

1. V2 has richer metadata than V1 in almost every dimension that matters for developer tooling
   (stability, codeowners, signal-level telemetry schema).
2. V1 has fields that V2 does not track: license, author attribution, and human-assigned tags.
   These fields are important for the opentelemetry.io registry page but are not needed for the
   Ecosystem Explorer.
3. V2 is already used by V1 automation for version updates, so the data pipeline connection
   exists.
4. V1 has some entries that V2 does not, particularly components from third-party distributions.
   These would need to be handled separately if V2 were to fully drive V1.
5. V1 has no mechanism for detecting new components or removing stale ones automatically. V2
   automation does this nightly.
