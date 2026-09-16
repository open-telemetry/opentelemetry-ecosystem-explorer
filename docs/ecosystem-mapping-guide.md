# Mapping a New Ecosystem

A guide for bringing a new OpenTelemetry ecosystem (a new language, instrumentation model, or
component type) into the registry. Tracked by
[#416](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/416), built
iteratively as each phase below gets fleshed out in its own PR.

## Who this is for

Anyone surveying a corner of the OpenTelemetry ecosystem, existing or brand new, to figure out what
metadata is available and how it could become part of this registry. Past and current examples of
this work: JavaScript instrumentation
([`projects/9-javascript-instrumentation/`](../projects/9-javascript-instrumentation/)), the V1 vs
V2 collector registry comparison
([`projects/119-legacy-registry-research/`](../projects/119-legacy-registry-research/)), and the
ongoing design discussion for Go compile-time instrumentation
([#916](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/916)).

## The lifecycle

Every ecosystem that has made it into the registry so far went through the same rough sequence, even
though nobody wrote it down as a formal process until now:

1. [**Research**](./ecosystem-mapping-research.md) - survey the upstream project(s): what metadata
   exists, where it lives, how consistently it's structured, and what's missing entirely. Produces
   an audit and a proposed registry schema.

2. **Schema design** - decide what fields the registry actually needs beyond what any existing
   upstream format already provides, and how versioning works for this ecosystem (one aggregated
   file per release, like Java, or independently-versioned per package, like JavaScript). _(detailed
   guidance: follow-up PR)_

3. **Automation** - build a watcher that extracts metadata from upstream and writes it to the
   registry, following the shared watcher contract in
   [`watcher-common`](../ecosystem-automation/watcher-common/). _(detailed guidance: follow-up PR)_

4. **Registry integration** - land the first versions under `ecosystem-registry/`, following the
   existing directory and file-format conventions documented in
   [Registry Structure](./registry-structure.md). _(detailed guidance: follow-up PR)_

5. **Database and frontend** - extend `explorer-db-builder` to ingest the new registry paths, and
   add the frontend types and pages to browse the new ecosystem. _(detailed guidance: follow-up PR)_

## Related reading

- [Architecture Overview](./architecture-overview.md) - how the three components fit together
- [Watchers and Registry Consumers](./watchers-registry-consumers.md) - the watcher contract in more
  detail
- [Registry Structure](./registry-structure.md) - existing per-ecosystem file layouts
