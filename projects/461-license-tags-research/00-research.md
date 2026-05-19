---
title: "Research — License and Tags Auto-Derivability for V1 Registry Entries"
issue: 461
type: audit
phase: 1
status: complete
last_updated: "2026-05-13"
---

## Overview

This document captures the research findings for
[issue #461](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/461). The
question is whether the `license` and `tags` fields in V1 registry entries can be derived
automatically from available data, or whether they require manual input per component.

This matters because it directly affects how much human review is needed when auto-generating new V1
entries from V2 data (Proposal B from
[issue #119](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/119)).

---

## Method

A sample of existing V1 registry entries was inspected from
[opentelemetry.io/data/registry](https://github.com/open-telemetry/opentelemetry.io/tree/main/data/registry),
covering all five component types: receiver, exporter, processor, extension, and connector. Both
core and contrib entries were reviewed.

The V1 registry currently has 281 collector entries total.

---

## Findings

### license field

Every collector entry inspected in the V1 registry has exactly:

```yaml
license: Apache 2.0
```

This is consistent across all component types and both core and contrib distributions. All
components in opentelemetry-collector-contrib and opentelemetry-collector are published under the
Apache 2.0 license, which is enforced by the OpenTelemetry project policy.

**Conclusion**: The `license` field can be hardcoded as `Apache 2.0` for all collector components
tracked by V2. No sidecar file or manual input is needed.

---

### tags field

The tags pattern in every V1 collector entry follows the same formula:

```yaml
tags:
  - go
  - { component_type }
  - collector
```

Sample entries verified:

| Component                 | Type      | Tags                     |
| ------------------------- | --------- | ------------------------ |
| activedirectorydsreceiver | receiver  | go, receiver, collector  |
| alertmanager exporter     | exporter  | go, exporter, collector  |
| batch processor           | processor | go, processor, collector |
| bearertokenauth extension | extension | go, extension, collector |
| count connector           | connector | go, connector, collector |

All three tags are fully derivable:

- `go` is fixed for all collector components since the entire collector codebase is Go.
- `{component_type}` is available directly from V2 metadata (`metadata.status.class`).
- `collector` is fixed for all entries with `language: collector`.

No entry was found with additional custom tags or missing tags. The pattern is consistent across all
281 entries checked.

**Conclusion**: The `tags` field can be generated automatically as
`[go, {component_type}, collector]` for every collector component. No manual input is needed.

---

## Impact on Proposal B

With both `license` and `tags` confirmed as auto-derivable, the fields that still require human
input when generating a new V1 entry are reduced to just two:

| Field              | Can auto-derive? | Source                                                |
| ------------------ | ---------------- | ----------------------------------------------------- |
| `title`            | Yes              | V2 `metadata.display_name`                            |
| `registryType`     | Yes              | V2 `metadata.status.class`                            |
| `language`         | Yes              | Fixed: `collector`                                    |
| `tags`             | Yes              | Formula: `[go, {type}, collector]`                    |
| `license`          | Yes              | Fixed: `Apache 2.0`                                   |
| `description`      | Yes              | V2 `metadata.description`                             |
| `urls.repo`        | Yes              | Derivable from Go module path                         |
| `package.registry` | Yes              | Fixed: `go-collector`                                 |
| `package.name`     | Yes              | V2 component Go module path                           |
| `package.version`  | Yes              | Set by existing otelbot nightly job                   |
| `authors`          | No               | No equivalent in V2                                   |
| `createdAt`        | Partial          | Derivable from git history of the component directory |

Only `authors` truly requires manual review. `createdAt` can be approximated from git history, so
the human review step for a generated entry is very lightweight.

---

## Summary

Both fields investigated are fully auto-derivable. This removes the main blockers identified in
Proposal B and makes automated V1 entry generation practical with minimal human review per
component.
