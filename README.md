# OpenTelemetry Ecosystem Explorer

This repository contains the components related to the OpenTelemetry Ecosystem Explorer, a web application that helps
users discover and explore the various projects available in the OpenTelemetry ecosystem.

See [project proposal](https://github.com/open-telemetry/community/blob/main/projects/ecosystem-explorer.md).

## Project Structure

There are three components in this repository:

| Component                | Description                                                                    |
|--------------------------|--------------------------------------------------------------------------------|
| **ecosystem-registry**   | Raw data registry storing metadata from various projects. Updated nightly.     |
| **ecosystem-automation** | Automation pipelines that populate the registry and synchronize documentation. |
| **ecosystem-explorer**   | React/Vite web application for exploring the data.                             |

## Contributing

This project welcomes contributions from the community.

Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.

See component READMEs for setup and development:

- [ecosystem-explorer](./ecosystem-explorer/README.md)
- [ecosystem-automation](./ecosystem-automation/README.md)

## Community

This project is run under the umbrella of the OpenTelemetry Communications SIG.
The Communications SIG meets every two weeks on Tuesday at 9:00 AM PT.
Check out the [OpenTelemetry community calendar][] for the Zoom link and any
updates to this schedule.

Meeting notes are available as a public [Google doc][].

You can also reach out in either `#otel-ecosystem-explorer` or `#otel-comms`
channels on [Slack][].

## Maintainers

- [Jay DeLuca](https://github.com/jaydeluca), Grafana Labs
- [Severin Neumann](https://github.com/svrnm), Causely
- [Pablo Baeyans](https://github.com/mx-psi), Datadog

For more information about the maintainer role, see
the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

## Approvers

- [Vitor Vasconcellos](https://github.com/vitorvasc), Mercado Libre
- [Marylia Gutierrez](https://github.com/maryliag), Grafana Labs

For more information about the approver role, see
the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).

[opentelemetry community calendar]:
https://calendar.google.com/calendar/u/0/embed?src=c_2bf73e3b6b530da4babd444e72b76a6ad893a5c3f43cf40467abc7a9a897f977@group.calendar.google.com

[google doc]:
https://docs.google.com/document/d/1wW0jLldwXN8Nptq2xmgETGbGn9eWP8fitvD5njM-xZY/edit?usp=sharing

[slack]: https://slack.cncf.io/
