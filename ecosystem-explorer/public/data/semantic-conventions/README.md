# Curated semantic-convention timeline

This directory is hand-maintained frontend data, outside the generated ecosystem registry.

See [the event audit](EVENT-AUDIT.md) for selection criteria, source checks, and the rationale for
retaining, correcting, splitting, or removing each non-baseline event.

## Accepted history and source metadata

`timeline.json` is the authoritative record of accepted history. Its formatting is intentionally
preserved, including bare release keys in `dates` and spec-era events, and it is not generated.
`sources.json` is a hand-authored sidecar that qualifies it without rewriting it:

- `sources`: repository-qualified source IDs (`semantic-conventions`, `semantic-conventions-genai`,
  and a frozen `opentelemetry-specification` that existing events cite but nothing monitors), their
  monitoring mode, relevant paths, and the `reviewedStart` revision. Accepted history covers that
  revision; later upstream changes are not yet reviewed. GenAI has no release tags, so its start is
  a commit, and it is the first commit made in the destination repository, not imported core
  history.
- `releases`: maps every key in `dates` to one source and tag (`1.0.0`–`1.20.0` are spec-era;
  `1.21.0` onward are core tags), with the immutable commit, the date basis, and the nearest
  ancestor release as comparison baseline. A bare key is never inferred; an unmapped or doubly
  mapped key fails validation. A comparison baseline is not a timeline `baseline` event.
- `lanes`: the upstream model namespaces behind each lane, and the migration boundary for GenAI.
- `evidence`: extra accepted links for an existing event ID. Only `accepted` evidence is published.

`validateHistory` checks the pair and `projectAcceptedHistory`
(`src/features/semantic-conventions/history/accepted-history.ts`) is the single projection used for
the agent output (`/data/semantic-conventions/accepted-history.json` and
`/agent/semantic-conventions/`). The timeline UI still loads `timeline.json` unchanged; the
projection carries each event through untouched.

Candidates proposed by upstream discovery are not accepted history and do not belong in this
directory. A maintainer accepts one by editing `timeline.json` and, where useful, `sources.json`.

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
