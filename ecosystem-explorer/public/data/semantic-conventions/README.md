# Curated semantic-convention timeline

This directory is hand-maintained frontend data, outside the generated ecosystem registry.

See [the event audit](EVENT-AUDIT.md) for selection criteria, source checks, and the rationale for
retaining, correcting, splitting, or removing each non-baseline event.

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
