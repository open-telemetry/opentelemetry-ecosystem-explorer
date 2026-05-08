# Prometheus Ecosystem Integration Research

This document outlines the research and strategy for integrating the Prometheus ecosystem into the
OpenTelemetry Ecosystem Explorer, addressing the requirements of Issue #203.

## Research Findings

The Prometheus ecosystem is vast, decentralized, and primarily community-driven. Unlike the core
OpenTelemetry components which are often managed within a few monolithic repositories, Prometheus
exporters and integrations are spread across hundreds of individual repositories.

### 1. Inclusion Criteria

To maintain a high-quality registry while capturing the breadth of the ecosystem, we propose the
following inclusion criteria:

- **Official Status**: All projects under the `prometheus` GitHub organization (exporters, client
  libraries) are included by default.
- **Maturity & Maintenance**: Community projects should demonstrate active maintenance (commits
  within the last 6-12 months) and significant adoption (e.g., GitHub stars, mentions in official
  Prometheus documentation).
- **Adherence to Best Practices**: Exporters should ideally follow the
  [Prometheus Exporter Guidelines](https://prometheus.io/docs/instrumenting/writing_exporters/).
- **OpenTelemetry Relevance**: Priority is given to components that facilitate the OTel-Prometheus
  bridge or are commonly used in OTel pipelines.

### 2. Component Categorization

Components are categorized into three main types:

1. **Exporters**: Services that translate third-party metrics into Prometheus format. These are
   further categorized by target (e.g., Database, Network, System, Cloud).
2. **Client Libraries (SDKs)**: Language-specific libraries for instrumenting applications.
3. **Integrations**: Software that has native Prometheus support (built-in exporters).

### 3. Metadata Schema

To provide a rich exploration experience, the following metadata is tracked:

- **Identity**: Name, Display Name, Description.
- **Categorization**: Type (exporter/sdk), Distribution (official/community), Target Category (for
  exporters), Language (for SDKs).
- **Links**: GitHub Repository, Official Website, Documentation.
- **Status**: Stability level (stable, beta, alpha) - primarily for official components.

### 4. Sourcing & Maintenance Strategy

Given the distributed nature of the Prometheus ecosystem, we recommend a hybrid approach to data
maintenance:

- **Initial Curation**: Manual seeding of the registry with official and high-profile community
  components (as implemented in the initial PR).
- **Crowd-Sourced Updates**: Encouraging community contributions via the
  `ecosystem-registry/prometheus` YAML files.
- **Semi-Automated Discovery**:
  - Periodic scraping of the `prometheus` and `prometheus-community` GitHub organizations.
  - Parsing the
    [Official Prometheus Exporters list](https://prometheus.io/docs/instrumenting/exporters/).
- **Validation Pipeline**: GitHub Actions to validate registry YAMLs against the schema and check
  for broken links.

## Implementation Status

We have implemented the foundational support for this integration:

- **Registry Structure**: Established `ecosystem-registry/prometheus` with versioned YAML storage.
- **Automation**: Added `prometheus-watcher` and integrated it into `explorer-db-builder` to
  transform registry data into the content-addressed format used by the frontend.
- **Explorer UI**: Created a dedicated Prometheus explorer page with filtering and search
  capabilities, integrated into the main application navigation.

## Future Recommendations

- **Watcher Expansion**: Develop the `prometheus-watcher` to automatically discover new releases of
  official exporters.
- **Integration Deep-Dive**: Expand metadata to include supported metrics and configuration examples
  for popular exporters.
- **Registry Schema**: Formalize the Prometheus registry schema in JSON Schema to enable better
  tooling support.
