---
title: "Metadata Audit — Python Instrumentation"
issue: 135
type: audit
phase: 1
status: in-progress
last_updated: "2026-08-31"
---

Analysis of the `opentelemetry-python-contrib` repository.

## Scope and Purpose

This document outlines the findings of the Phase 1 metadata audit for the Python instrumentation
ecosystem. The goal is to identify available metadata in `opentelemetry-python-contrib` to inform
the future registry schema and automation processes, as tracked in
[#1029](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/1029) and
[#135](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/135).

**Boundary Note:** The `opentelemetry-python-contrib` repository contains a separate
`instrumentation-genai` area. This audit explicitly focuses on the core Python instrumentation and
avoids duplicating the separate GenAI ecosystem efforts tracked in
[#154](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/154).

## Current Explorer State

Currently, the Explorer has **no** dedicated Python instrumentation ecosystem implementation.

- There is no ecosystem registry schema for Python.
- There are no Python watchers.
- The UI does not expose Python instrumentation.

## Upstream Metadata Sources

Unlike the JavaScript ecosystem, Python upstream metadata is primarily structured rather than
README-driven. The main sources are:

1. **`pyproject.toml`**
   - **Contains:** Package name, description, Python version support (`requires-python`),
     auto-instrumentation entry points, and supported instrumented library/version ranges (via
     `project.optional-dependencies.instruments` or `instruments-any`).
   - **Format:** Structured (TOML), machine-readable.
   - **Status:** Authoritative source for package configuration.

2. **`package.py`**
   - **Contains:** `_instruments`, `_supports_metrics`, and `_semconv_status`.
   - **Format:** Structured Python file.
   - **Status:** Authoritative code-level metadata used by the repository's tooling. Duplicates some
     data from `pyproject.toml`.

3. **Generated `instrumentation/README.md`**
   - **Contains:** Aggregate view generated from package metadata.
   - **Format:** Generated Markdown.
   - **Status:** Individual package README files do not appear to provide unique Explorer-relevant
     metadata not found in structured sources.

## Metadata Field Audit

The following fields were identified across the Python instrumentation packages:

| Field                            | Source                                        | Classification                                        |
| :------------------------------- | :-------------------------------------------- | :---------------------------------------------------- |
| Package/PyPI name                | `pyproject.toml`                              | Directly structured                                   |
| Package description              | `pyproject.toml`                              | Directly structured                                   |
| Instrumented library             | `pyproject.toml` (instruments) / `package.py` | Directly structured                                   |
| Supported library version ranges | `pyproject.toml` (instruments) / `package.py` | Consistently encoded but requiring parsing/convention |
| Python version support           | `pyproject.toml` (`requires-python`)          | Directly structured                                   |
| Auto-instrumentation entry point | `pyproject.toml`                              | Directly structured                                   |
| Instrumentation version          | Hatch config / `version.py`                   | Generated/Resolved                                    |
| Semantic-convention status       | `package.py` (`_semconv_status`)              | Directly structured                                   |
| Metrics support                  | `package.py` (`_supports_metrics`)            | Directly structured                                   |
| Dependencies                     | `pyproject.toml`                              | Directly structured                                   |
| Owner information                | None identified in sample                     | Missing                                               |
| Source/package path              | Git tree                                      | Inferred                                              |
| Documentation URL                | `pyproject.toml` (URLs)                       | Directly structured                                   |

## Duplication and Reliability Findings

There is a known duplication of supported library versions between:

- `pyproject.toml` -> `instruments` / `instruments-any`
- `package.py` -> `_instruments`

A targeted inspection of a sample of packages showed agreement between these two sources. However,
no CI enforcement was identified in the targeted inspection to ensure they do not diverge. This
duplication must be handled carefully by future watchers.

## README Findings

A sample of 3 of the 47+ packages indicates that individual Python instrumentation READMEs do not
appear to add unique metadata needed for the Explorer. Therefore, README scraping should **not** be
the primary approach for metadata extraction.

_Note: As this finding is based on a limited sample, it is a strong inference rather than an
exhaustive proof._

## Versioning Findings

The `opentelemetry-python-contrib` repository employs a **hybrid versioning model**.

- Most instrumentation packages follow the repository's lockstep release cadence.
- A growing subset of independently released packages have their own versioning.

This contrasts with:

- **Java's aggregated model:** One single agent version for everything.
- **JavaScript's independently-versioned package model:** Every package versions on its own.

**Recommendation:** A package-oriented representation is the more natural starting point for the
Python ecosystem, while explicitly accounting for the hybrid release model in the registry design.

_(Note: This is a documented recommendation only. No changes are being made to
`docs/registry-structure.md` or the ecosystem registry at this phase.)_

## Comparison with JavaScript

Compared to the JavaScript ecosystem ([#9](../9-javascript-instrumentation/)), the Python ecosystem
presents different challenges and opportunities:

- **Structured Metadata:** Python relies heavily on structured TOML (`pyproject.toml`) and code
  (`package.py`) metadata, whereas JS heavily relies on README scraping.
- **Version Resolution:** Python package versioning is more complex, requiring resolution through
  `version.py` or Hatch configuration, unlike a simple `package.json` field.
- **Release Model:** Python uses a hybrid release model (lockstep + independent), whereas JS
  packages version independently.
- **Telemetry Metadata:** Python has much thinner telemetry metadata (spans/attributes) available in
  upstream documentation compared to some JS packages.
- **README Usefulness:** Python README parsing is significantly less useful as a primary data
  source.

## Future Implications

The findings of this audit will inform subsequent phases:

- **Phase 2:** Registry schema design must accommodate the hybrid versioning model and structured
  data sources.
- **Phase 3:** Watcher implementation will need to parse `pyproject.toml` and `package.py` instead
  of scraping READMEs.
- **Later Phases:** Downstream integration into the Explorer database and UI.

_(These phases are strictly OUT OF SCOPE for this issue)._
