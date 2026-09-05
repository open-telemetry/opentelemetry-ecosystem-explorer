---
title: "Roadmap — Python Instrumentation Research"
issue: 135
type: roadmap
phase: "meta"
status: in-progress
last_updated: "2026-09-05"
---

## Phase 1: Metadata Audit (Complete)

- [x] Investigate upstream metadata sources (`pyproject.toml`, `package.py`, `README.md`)
- [x] Document the duplication and reliability of supported library versions
- [x] Analyze the hybrid versioning model used in `opentelemetry-python-contrib`
- [x] Explicitly define the boundary between core Python instrumentation and GenAI instrumentation

## Phase 2: Registry and Schema Design (Complete)

See [`02-schema-design.md`](./02-schema-design.md).

- [x] Design registry schema to support Python's structured metadata
- [x] Account for Python's hybrid release model in the registry layout
- [x] Determine how to handle packages that release lockstep vs independently versioned ones

## Phase 3: Watcher and Automation (Future)

- [ ] Draft Phase 3 watcher architecture for extracting metadata from `pyproject.toml` and
      `package.py`
- [ ] Implement parsing logic for supported versions (`instruments`, `instruments-any`,
      `_instruments`)

## Later Phases (Future)

- [ ] Populate database builder with Python ecosystem data
- [ ] Integrate Python instrumentation into the Explorer frontend

## Open Questions

1. How should the Explorer visually represent Python's hybrid versioning model?
2. Since telemetry metadata (spans/attributes) is thin, what is the minimum viable telemetry
   coverage required to display a package?

Schema-level open decisions carried into Phase 3 (parsing conventions, source reconciliation, and
whether a structural lockstep-vs-independent signal exists) are tracked in
[`02-schema-design.md` §7](./02-schema-design.md#7-open-decisions-for-maintainers) rather than
duplicated here.
