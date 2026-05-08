---
title: "Roadmap — GenAI ecosystem research"
issue: 154
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-05-08"
---

## Next steps

---

## Where we are

- Initial research sweep complete: frameworks surveyed across Python, JS/TS, Java, and .NET.
- Findings documented in [`00-research.md`](./00-research.md), covering instrumentation type (native
  / contrib / third-party), signals captured, and semconv adoption level per framework.
- The [genai-otel-conformance](https://github.com/trask/genai-otel-conformance) project identified
  as a useful integration point — it runs automated attribute-level coverage tests for 40+
  libraries.

---

## Immediate next steps

In order:

- [ ] Post findings summary as a comment on
      [#154](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/154) to get
      maintainer feedback before any registry work begins.
- [ ] Confirm with maintainers how GenAI instrumentation should be represented in the explorer: as a
      new ecosystem entry, as a category within existing ecosystems, or as a separate data type.
- [ ] Review the genai-otel-conformance dashboard for per-attribute coverage data that could feed
      into the registry.
- [ ] Identify which frameworks are structured enough to support automated data extraction vs. which
      need manual curation.

---

## Open questions

| #   | Question                                                                                                                         | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Should GenAI instrumentation be a new top-level ecosystem in the explorer, or surfaced as a signal/category on existing entries? | Open   |
| 2   | Is the genai-otel-conformance dashboard an integration target (i.e., pull its data into the registry) or just a reference?       | Open   |
| 3   | How should third-party (non-OTel-org) instrumentation libraries be classified vs. contrib/native ones?                           | Open   |
| 4   | Which languages are in scope for a first registry cut? (Python + JS/TS and Java now seem viable; .NET remains behind.)           | Open   |

---

## Decision log

| Date       | Decision                                                                            | Notes                                                         |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-05-07 | Scoped initial research to Python, JS/TS, Java, and .NET per the issue description. | Aligns with the four languages called out in the issue scope. |
