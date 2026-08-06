# Upstream Metadata

Most of the data that powers the explorer is sourced from **metadata that lives in the component's
own upstream project** (pulled in via ecosystem-automation "watchers". When that upstream metadata
is missing or incomplete, the Explorer has nothing better to show, so it falls back to a less
friendly value (for example, a raw component identifier instead of a readable name).

This page explains where that metadata comes from and gives a short runbook for fixing it upstream.
It is the reference material behind the automatically generated `upstream-metadata` tracking issues.

## Working an `upstream-metadata` issue

The Explorer opens and maintains tracking issues labeled `upstream-metadata` (and
`contribution welcome`) when it detects upstream metadata gaps (currently: Collector components
missing a `display_name`). These issues are a good first contribution:

- They are updated automatically every night and **close on their own** once the tracked gap is
  filled upstream — you do not need to touch this repository.
- Each issue lists the affected components and points at the upstream repository where the fix
  belongs.

The fix always happens in the upstream project, not here. Find the relevant ecosystem below and
follow its runbook.

## Collector

Collector component names and descriptions come from a `metadata.yaml` file that lives next to each
component's source code, in one of two upstream repositories:

- **Core** components —
  [`open-telemetry/opentelemetry-collector`](https://github.com/open-telemetry/opentelemetry-collector)
- **Contrib** components —
  [`open-telemetry/opentelemetry-collector-contrib`](https://github.com/open-telemetry/opentelemetry-collector-contrib)

Each component sits in a directory grouped by type (`receiver/`, `processor/`, `exporter/`,
`extension/`, `connector/`), and the file you care about is that directory's `metadata.yaml` — for
example `processor/transformprocessor/metadata.yaml`. There are two fields that are especially
important for the Explorer, but are not required in the collector metadata tooling, and therefore we
like to track and make an effort to contribute fixes upstream:

- `display_name` — the human-readable name shown as the component's title. When it is absent, the
  Explorer shows the raw component identifier instead.
- `description` — a short summary shown on the component. When it is absent, a generic placeholder
  is shown.

### Runbook: add a missing `display_name` (or `description`)

1. Open the tracking issue and note which component is missing metadata and whether it is a **core**
   or **contrib** component.
2. In the matching upstream repository, find the component's directory and open its `metadata.yaml`.
3. Add the missing field at the top level of the file. For example:

   ```yaml
   type: transform
   display_name: Transform Processor
   description: Modifies telemetry based on configuration using OTTL.
   ```

4. Open a pull request against the upstream repository, following that repository's `CONTRIBUTING`
   guide. Reference the Ecosystem Explorer tracking issue in your PR description so the context is
   clear.
5. Once your change is merged upstream, no further action is needed here. The Explorer's nightly
   build picks up the new metadata, and the tracking issue closes automatically once every listed
   component has a `display_name`.
