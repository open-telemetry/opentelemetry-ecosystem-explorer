# Phase 1: Research

Part of the [ecosystem mapping guide](./ecosystem-mapping-guide.md). This phase comes before any
code: the goal is to understand an upstream ecosystem well enough to know what a registry entry for
it should even contain.

## What this phase produces

- An audit document under `projects/<issue-number>-<slug>/`, following the conventions in
  [`projects/_index.md`](../projects/_index.md) (`type: audit`, `phase: 1`).
- A first-draft proposed registry schema, informed by the audit rather than assumed up front. This
  feeds directly into [Phase 2: Schema design](./ecosystem-mapping-guide.md).

## What to survey

There's no fixed checklist that fits every ecosystem exactly, but these questions have come up for
every ecosystem mapped into this registry so far:

- **Where does the metadata live?** One upstream repository, or scattered across many independently
  maintained ones? This changes both how hard the automation is and how the registry should be
  scoped. See the third-party-repository discussion on
  [#916](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/916) for a live
  example of why this question matters before anything else gets decided.
- **What's already machine-readable today?** Package manifests, structured metadata files, or
  consistently formatted sections of documentation the automation could parse directly.
- **What exists but is inconsistent?** Information that's present most of the time but varies in
  format, heading name, or level of detail from one component to the next.
- **What's missing entirely?** Information you'd want in the registry that isn't captured anywhere
  upstream yet, and would require an upstream change to get.
- **How does upstream version things?** A single release train for the whole project, or
  independently versioned packages/components. This directly determines the registry layout choice
  made in Phase 2 (one aggregated file per release vs. one file per package version).

## Worked examples

These are real research docs already in this repository, shown here as examples of the kind of
output this phase produces, not as a template to copy field-for-field. Each ecosystem is different
enough that the right structure depends on what you find.

- [JavaScript instrumentation metadata audit](../projects/9-javascript-instrumentation/01-metadata-audit.md) -
  surveys a many-small-independently-versioned-packages ecosystem (js-contrib), breaking down what's
  machine-readable, what's inconsistent, and what's missing per package.
- [#916](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/916) - research
  happening as open discussion on an issue thread instead of a written document first. Worth reading
  as an example of this phase being collaborative and public rather than a solo write-up handed over
  once finished.

## Lessons from prior research

The Java instrumentation metadata project surfaced a few hard-won lessons worth carrying into any
new survey:

- **A third data-gathering technique, beyond automation and manual files**: intercepting real
  telemetry during integration test runs. Instrumentations already exercised in tests become
  metadata sources without any static code analysis.
- **Telemetry output isn't static.** It can change based on upstream configuration, not just which
  library version is in use. A concrete example: toggling Java's semconv-stability opt-in flag
  renamed `db.client.connections.usage` to `db.client.connection.count` and restructured attribute
  names. This is why the real registry schema conditions telemetry on a `when:` field rather than
  assuming one fixed shape per instrumentation.
- **Set realistic expectations for how complete this gets.** Even a mature, well-resourced effort
  like the Java one started with roughly 10% of modules having descriptions, and had reached about
  45% completion by the point it called phase 1 done. Treat this phase as iterative, not a one-shot
  audit.

## Next

Once the survey is done, move to [Phase 2: Schema design](./ecosystem-mapping-guide.md) with the
audit findings in hand.
