# OpenTelemetry Ecosystem Explorer

This repository contains the components related to the OpenTelemetry Ecosystem Explorer, a web application that helps
users discover and explore the various projects available in the OpenTelemetry ecosystem.

See [project proposal](https://github.com/open-telemetry/community/blob/main/projects/ecosystem-explorer.md).

## Project Structure

There are three components in this repository:

### ecosystem-registry

This will act as our raw data registry of the metadata from various projects. It is updated nightly by the
automation tools in ecosystem-automation (`collector-watcher`, `documentation-sync`).

### ecosystem-automation

Automation pipelines and tools to populate and maintain the ecosystem-registry, and to synchronize documentation and other
targets with the registry data.

### ecosystem-explorer

React/Vite web application for exploring the data. See [instrumentation-explorer](https://github.com/jaydeluca/instrumentation-explorer)
for a POC/reference.

## Contributing

This project welcomes contributions from the community.

Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.

See the [ecosystem-explorer README](./ecosystem-explorer/README.md) for setup and development instructions.

See the [ecosystem-automation README](./ecosystem-automation/README.md) for setup and development instructions.

## Maintainers

* [Jay DeLuca](https://github.com/jaydeluca), Grafana Labs
* [Severin Neumann](https://github.com/svrnm), Causely
* [Pablo Baeyans](https://github.com/mx-psi), Datadog

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

## Approvers

* [Vitor Vasconcellos](https://github.com/vitorvasc), Mercado Libre
* [Marylia Gutierrez](https://github.com/maryliag), Grafana Labs

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).
