# OpenTelemetry Ecosystem Explorer

This repository contains the components related to the OpenTelemetry Ecosystem Explorer, a web application that helps
users discover and explore the various projects available in the OpenTelemetry ecosystem.

See project proposal [here](https://github.com/open-telemetry/community/blob/main/projects/ecosystem-explorer.md).

## Project Structure

There are three components in this repository:

### ecosystem-registry

This will act as our data pipeline and raw data registry of the metadata from various projects. See the
`collector-metadata` directory in the [collector-watcher](https://github.com/jaydeluca/collector-watcher/tree/main/collector-metadata)
as a POC/reference.

Scope:

* Stores versioned history of metadata for each project

### ecosystem-automation

This will act as our data pipeline and tools for synchronizing documentation, the v1 registry, and anything else.

See the [collector-watcher](https://github.com/jaydeluca/collector-watcher/tree/main/src/collector_watcher) for the
POC/reference.

Scope:

* Pipelines and automation that runs on a schedule and collects and aggregates metadata from various projects to
populate and update the registry
* Automatically synchronizes documentation and other targets with registry data opentelemetry.io integration
  * Collector components
  * Java Agent instrumentations
  * Java Agent configuration options

### ecosystem-explorer

This will be the website for exploring the data. See [instrumentation-explorer](https://github.com/jaydeluca/instrumentation-explorer)
for a POC/reference.

## Contributing

This project welcomes contributions from the community.

Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.

## Maintainers

* [Jay DeLuca](https://github.com/jaydeluca), Grafana Labs
* [Severin Neumann](https://github.com/svrnm), Causely
* [Pablo Baeyans](https://github.com/mx-psi), Datadog

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

## Approvers

* [Vitor Vasconcellos](https://github.com/vitorvasc), Mercado Libre
* [Marylia Gutierrez](https://github.com/maryliag), Grafana Labs

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).
