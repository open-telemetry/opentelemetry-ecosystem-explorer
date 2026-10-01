# Audit mode

Checks V1 pages against the UX research and information architecture (IA) work in
[`projects/ux-research-and-info-arc/`](../../../projects/ux-research-and-info-arc/):

- `guiding-principles-for-ecosystems.md`: the seven cross-ecosystem rules and the five-node baseline.
  This is the checklist. Read it in full before starting; every rule carries a "Why", which you cite
  as the gap's evidence.
- `ecosystem-explorer-ia-recommendation.md`: the shell's entry points and each ecosystem's taxonomy.
- `user-interview-synthesis.md` and `user-narratives-from-ecosystem-explorer-research.md`: research
  evidence to quote when a rule's "Why" is not enough.

The audit reports **gaps**: something a rule asks for that the page does not do. It proposes a
disposition for each gap; the triage decides.

## Levels

Audit each page at the level it belongs to.

1. **Shell** (`/` and the shared layout): the four entry points of the IA recommendation (Search,
   Ecosystems, Signals, Recent Activities) exist and each one leads somewhere useful.
2. **Ecosystem** (each ecosystem's landing and list pages):
   - Rule 1: the ecosystem is reachable through a browsable path, not search alone.
   - Rule 4, preview level: list cards and search results summarize each component's telemetry.
   - The taxonomy follows how the ecosystem is built: the Collector groups components by type; the
     Java Agent is one bundled tool made of instrumentations.
3. **Component** (the Collector component page and its diff, and the Java Agent instrumentation
   page):
   - The five nodes, in order: Overview, Expected Telemetry, Semantic Convention Conformance,
     Configuration, Version History.
   - Rules 2 and 3 (Version History is a top-level node and says what changed), rule 4 at full
     detail, rule 5 (configuration options explain their effect), rule 6 (tiered conformance), and
     rule 7 (evaluative content inline, deep reference linked out).

## Recording a gap

For every rule and node at the page's level, record:

- **Status**: present, partial, or missing.
- **Where**: the tab, section, or rail that carries it today.
- **Gap**: what the rule asks for that the page does not do.
- **Evidence**: the rule's "Why", or a research quote.
- **Data**: whether the registry already has the data the rule needs. Per-version "what changed"
  needs version diffs; tiered conformance needs semantic convention data. A gap that waits on data is
  a pipeline gap, not a UI gap: name it as one.
- **Proposed disposition**: `V1` (fix before go-live) or `post-V1`, with one line of reasoning.

The audit is done when every rule and node of its level has a row for every page in scope.

## Triage

Post the gap table as a comment on the redesign audit issue. The maintainers triage the gaps
asynchronously, case by case, in that issue's comments:

- `V1`: the gap becomes an issue labeled `v1:audit` and `v1:blocker`.
- `post-V1`: the gap becomes an issue labeled `v1:audit`, outside the go-live path and outside the
  `V1 Launch` milestone.
