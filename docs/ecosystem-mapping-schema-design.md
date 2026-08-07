# Phase 2: Schema Design

Part of the [ecosystem mapping guide](./ecosystem-mapping-guide.md). This phase turns the
[Phase 1](./ecosystem-mapping-research.md) audit into concrete decisions about what a registry entry
for this ecosystem contains and where it lives, before any watcher code gets written.

## What this phase produces

- A schema decision written up alongside the Phase 1 audit under `projects/<issue-number>-<slug>/`,
  following the conventions in [`projects/_index.md`](../projects/_index.md). A worked example of
  what this looks like in practice is the "Proposed registry schema" and "Versioning model" sections
  of the [JavaScript metadata audit](../projects/9-javascript-instrumentation/01-metadata-audit.md)
  — the same document that did the Phase 1 survey.
- A first-cut YAML shape for the new ecosystem's registry files, informed by what Phase 1 found
  machine-readable, inconsistent, and missing upstream, not by copying an existing ecosystem's
  schema field-for-field.

## Decisions to make

- **What does "distribution" mean here, if anything?** The
  `{ecosystem}/[{distribution}/]v{version}/` layout (see
  [Registry Structure](./registry-structure.md)) only has a distribution segment where an ecosystem
  actually ships more than one variant: `javaagent` for Java, `core`/`contrib` for Collector.
  Configuration and .NET have no distribution concept at all and are versioned directly under
  `{ecosystem}/v{version}/`. Don't add a distribution segment because the layout supports one — add
  it only if Phase 1 found more than one shipped variant.
- **How does this ecosystem version?** Most ecosystems have one release train, so the registry
  stores one aggregated file per component type per version. JavaScript is the documented exception:
  because `js-contrib` packages version independently, there's no single "js agent version" to key
  the registry off, so it's stored per package instead (`javascript/{package-name}/v{version}.yaml`,
  see [Registry Structure](./registry-structure.md#javascript-structure)). Phase 1 should have
  already surfaced which model applies; this phase makes it official.
- **What happens when upstream sources disagree?** The JS audit found the README's supported-version
  range for `express` (`>=4.0.0 <6`) didn't match `.tav.yml`'s tested range (`>=4.16.2 <6`), and
  kept both as separate fields (`supported_versions` sourced from the README, `tested_versions`
  sourced from `.tav.yml`) rather than picking a winner. Decide per-ecosystem whether disagreement
  gets resolved by picking a source of truth or by keeping both fields with their provenance.
- **What's the minimum viable schema for a first watcher, versus what needs upstream work first?**
  Not every field the mature ecosystems have is achievable on day one. The JS audit found only 8 of
  47 packages had any structured telemetry data at all, so its first-cut schema omitted a
  `telemetry` field entirely rather than block the whole effort on an upstream change. Write down
  what's deliberately deferred and why, so it isn't mistaken for an oversight later.
- **Does any field need conditioning on upstream configuration?** Telemetry output isn't always
  static — see the Java semconv-stability example in
  [Phase 1](./ecosystem-mapping-research.md#lessons-from-prior-research). If this ecosystem has an
  equivalent (a flag, a mode, a build tag that changes what gets emitted), the schema needs a
  discriminator field like Java's `telemetry[].when`, not one fixed shape per component.
- **What's the stable sort key for every array field?** See
  [CAS implications](#cas-implications-for-array-fields) below — this has to be decided at schema
  design time, not left to whatever order the watcher happens to iterate in.

## CAS implications for array fields

The registry's downstream content-addressing hash
(`ecosystem-automation/explorer-db-builder/src/explorer_db_builder/content_hashing.py`) normalizes
dictionaries by sorting their keys recursively, but it does **not** sort list contents — array order
is preserved exactly as given. That means every array field in a new schema (a list of
instrumentations, attributes, target versions, whatever) needs a documented, stable sort key the
watcher applies before writing. If two runs over the same upstream state produce the same records in
different orders, they hash differently and bust the content-addressed cache on every single field
that contains that array, not just the reordered one. `ecosystem-automation/AGENTS.md` states this
requirement for watcher output generally; this phase is where the specific sort key for each new
array field gets chosen. See [Content-Addressed Storage](./content-addressed-storage.md) for how the
hash is used downstream.

## What the watcher contract does and doesn't give you for free

`watcher-common`'s `BaseInventoryManager` (see
`ecosystem-automation/watcher-common/src/watcher_common/inventory_manager.py`) provides directory
listing, version-existence checks, and snapshot cleanup — but it has no abstract methods enforcing
their use. `version_exists()` has to be called by the watcher itself before processing a version,
and domain-specific save/load (what `JavaagentInventoryManager` adds on top of the base class) is
written per ecosystem, not inherited. The Collector watcher doesn't use `BaseInventoryManager` at
all; its distribution-aware layout needed a different inventory manager. Decide during this phase
whether the new ecosystem's versioning model fits the base class's flat `v{version}/` assumption, or
needs a custom inventory manager the way Collector did — that decision belongs here, not as
something discovered mid-implementation in Phase 3.

## Worked examples

- [JavaScript metadata audit](../projects/9-javascript-instrumentation/01-metadata-audit.md) — the
  "Proposed registry schema" and "Versioning model" sections show a first-cut schema derived
  directly from the Phase 1 findings above it, and an explicit call-out of what would need upstream
  work before the registry could reach parity with Java.
- [Registry Structure](./registry-structure.md) — compare the Java, .NET, JavaScript, Configuration,
  and Collector file formats side by side to see how differently "distribution" and "versioning
  model" resolve per ecosystem, even though they all share the same base directory convention.

## Next

Once the schema and versioning model are decided and written up, move to Phase 3: Automation to
build the watcher against them. _(detailed guidance: follow-up PR)_
