# Curated semantic-convention timeline

This directory is hand-maintained frontend data, outside the generated ecosystem registry.

See [the event audit](EVENT-AUDIT.md) for selection criteria, source checks, and the rationale for
retaining, correcting, splitting, or removing each non-baseline event.

## Accepted history

`timeline.json` is the single hand-authored record of accepted history; it is curated by hand and not
generated from upstream. The timeline UI and the agent output read these same records. Its `$schema`
(`public/schemas/semantic-conventions-history.schema.json`, generated from `TimelineData`) lets
editors flag mistakes, and `validateHistory`
(`src/features/semantic-conventions/history/accepted-history.ts`) checks it in tests and in the
agent-docs build.

- `sources`: repository-qualified source IDs (`semantic-conventions`, `semantic-conventions-genai`,
  and a frozen `opentelemetry-specification` that existing events cite but nothing monitors), their
  monitoring mode, relevant paths, and `reviewedThrough`, the revision accepted history covers.
  Later upstream changes are not yet reviewed. GenAI has no release tags, so its mark is a commit:
  the first commit made in the destination repository, not imported core history.
- `releases`: keyed `{source}@{tag}` because two repositories can publish the same tag
  (`1.0.0`–`1.20.0` are spec-era; `1.21.0` onward are core). Each has its `tag`, immutable `commit`
  (absent for the frozen source), `date`, `dateBasis`, and `baseline`, the nearest ancestor release
  of the same source. A comparison baseline is not a timeline `baseline` event.
- `lanes`: the display fields plus the upstream model `namespaces` each lane covers and, for GenAI,
  the `migration` boundary.
- `events`: `revision` is a release key, or `{ source, commit }` for a source without releases
  (spec-era origins today, GenAI milestones later). Optional inline `evidence` links each cite a
  source's own repository.

Candidates proposed by upstream discovery are not accepted history and do not belong in this
directory. A maintainer accepts one by editing `timeline.json`. Event wording and the historical
formatting of older events are intentionally preserved.

The agent output is published at `/agent/semantic-conventions/`. `accepted-history.json`, beside
it under `/data/semantic-conventions/`, is the stable agent-facing alias of `timeline.json`: the
build validates `timeline.json` and writes the same records, so the two never differ in content.
Edit only `timeline.json`.

`dateBasis` on an event is set only for a commit revision: `specification-commit` for the
specification's UTC committer date, `commit-date` for the same on any other source (for example a
GenAI milestone). A release revision takes its date and basis from the release.

## De facto baselines

`baseline` events identify explicit version references in upstream guidance that asks existing
instrumentations to preserve their defaults or defer breaking changes. “De facto baseline” is an
Explorer label, not an upstream stability status or a measurement of adoption. The notices also
cover earlier versions; they do not require every instrumentation to emit the referenced version.

Events use the referenced version's release date, not the date the notice was introduced. Release
dates come from the upstream changelog (1.20.0, 1.21.0, 1.24.0) and GitHub release `published_at`
metadata (1.36.0, 1.37.0). Sources are pinned to documentation tags so the evidence survives
subsequent changes to the website.

| Domain             | Baseline | Release date | Compatibility notice                                                                                                          |
|--------------------|----------|--------------|-------------------------------------------------------------------------------------------------------------------------------|
| HTTP               | 1.20.0   | 2023-04-07   | [HTTP](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/http/README.md)                               |
| Database           | 1.24.0   | 2023-12-15   | [Database](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/db/README.md)                             |
| Messaging          | 1.24.0   | 2023-12-15   | [Messaging](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/messaging/README.md)                     |
| RPC                | 1.37.0   | 2025-08-25   | [RPC](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/rpc/README.md)                                 |
| System metrics     | 1.21.0   | 2023-07-13   | [System metrics](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/system/system-metrics.md)           |
| OS process metrics | 1.21.0   | 2023-07-13   | [Process metrics](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/system/process-metrics.md)         |
| GenAI              | 1.36.0   | 2025-07-05   | [GenAI before its repository move](https://github.com/open-telemetry/semantic-conventions/blob/v1.41.0/docs/gen-ai/README.md) |

The v1.44.0 documentation was searched across domains for compatibility notices, version references,
and stability opt-ins. GenAI's historical notice was checked in v1.41.0 because the current core
page only records its move. No explicit version baseline was identified for the remaining timeline
lanes: JVM, Kubernetes, browser, CI/CD + VCS, or other domains. Kubernetes has migration guidance
without a pinned baseline version. The code-attribute migration guide compares versions but does not
designate a version whose defaults must be preserved. Neither is sufficient evidence to invent a
baseline event. Revisit these gaps when upstream publishes more specific guidance.
