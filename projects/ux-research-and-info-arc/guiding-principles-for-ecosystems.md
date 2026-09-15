# Ecosystem Explorer: Guiding Principles for Ecosystems & Component Pages

A working reference for building out any ecosystem or component page in the Ecosystem Explorer.
Where the IA Recommendation explains why the structure looks the way it does, this doc distills that
reasoning into concrete rules for what to actually build. Each rule traces back to a specific
research finding, stakeholder input or resolved IA question.

## TL;DR: Quick checklist for any new component page

- Reachable through at least one non-search path
- Overview present
- Expected Telemetry has both a preview (listing/search) and full detail (component page)
- Semantic Convention Conformance communicates tiered coverage, where a relevant convention exists
- Configuration options explain their effect on output, where applicable
- Version History communicates specific changes, where that information is available
- Deep reference material is linked, not duplicated

## How to use this doc

If you're building a new ecosystem branch (e.g. JavaScript) or a new component page within an
existing one, check each rule below against what you're building. The five-node baseline (Overview,
Expected Telemetry, Semantic Convention Conformance, Configuration, Version History) serves as the
recommended baseline. These rules define what "done" could look like for each node, regardless of
which ecosystem it lives in.

## Cross-ecosystem principles

### 1. Discovery should not depend on search alone

Every ecosystem should be reachable through at least one browsable path (an ecosystem listing, a
signal-based filter, or recent activity) in addition to search, rather than relying on users to
already know what they are looking for.

**Why:** One participant described discovering components through community channels because they
did not know a component existed to search for it. Another described similar instances of accidental
discovery through conversations, where information surfaced without them actively searching for it.
Together, these experiences suggest that discovery should not depend on search alone.

### 2. Version History should be a core, top-level node, not buried in configuration or overview content

Each component should expose a dedicated Version History node. Where version information is
available, it should remain accessible as a distinct top-level section rather than being folded into
Overview or Configuration.

**Why:** Version-specific information mattered to 5 of 7 research participants, and competitors
consistently treat version as core metadata. This is one of the most evidence-backed rules in the
whole project.

### 3. Version History should clearly communicate what changed, rather than only indicating that a change occurred

Where possible, a release entry should identify specific spans, metrics, or attributes that were
added, removed, or altered, rather than relying solely on a version number and a generic "see
changelog" link.

**Why:** Multiple participants described changelog descriptions as insufficient, particularly when
they did not clearly explain changes to telemetry such as newly available metrics or renamed fields.

### 4. Expected Telemetry should be presented at two levels of detail: preview and full detail

A condensed telemetry summary (e.g. span/metric counts or headline attributes) should be available
on listing cards and search results, allowing users to assess relevance before opening the full
component page. The complete, expanded version lives on the component's own page.

**Why:** Research highlighted the importance of understanding what telemetry a component or
instrumentation produces. Providing a summary at discovery points and fuller detail on the
individual page supports that need without requiring users to open every component page.

### 5. Configuration options should be paired with their effect, rather than presented as flags alone

Where applicable, each configurable option should explain in plain terms how changing it affects the
emitted telemetry, alongside its name, type, and default value.

**Why:** Configuration effects were identified as unclear by research participants and underserved
by every competitor reviewed. A flag with no stated effect leaves the user to determine its impact
elsewhere.

### 6. Semantic Convention Conformance should show tiered coverage, not a binary yes/no

Where applicable, conformance should communicate the level of attribute coverage. For example,
Required, Conditionally Required, Recommended, or Opt-in rather than reducing conformance to a
simple "conformant" or "not conformant" label.

**Why:** A project stakeholder shared a reference example where the conformance was represented
using tiered coverage (Required / Conditionally Required / Recommended / Opt-in) across several
libraries being compared against the same convention, rather than a single pass/fail label. Using a
tiered structure keeps the Explorer consistent with the reference approach already established for
conformance, and avoids collapsing multiple distinct levels of coverage into one binary result.

### 7. Evaluative information is consolidated; deep reference material is linked out, not duplicated

Version, Expected Telemetry, and Configuration effects should be fully readable inside the Explorer.
Full source code, exhaustive API references, and long-form guides should generally remain at their
original source, with the Explorer linking to them rather than duplicating the full content.

**Why:** This matches both the competitive pattern (docs integrated with package info, not replacing
it) and the research: users want a fast starting point, not a replacement for the other sources they
already trust.

## Ecosystem-specific adaptation

Ecosystems should share a consistent information structure at the component level without requiring
identical taxonomies at the ecosystem level. When adding a new ecosystem, first identify how its
components are actually built, distributed, versioned, and discovered, then use those
characteristics to determine how components should be grouped and named. Once a user reaches an
individual component, apply the recommended five-node baseline: Overview, Expected Telemetry,
Semantic Convention Conformance, Configuration, and Version History.

For example, Java may organize around instrumentations bundled within the Java Agent, while Python
may organize around independently distributed instrumentation packages, these differences should be
reflected in how users discover components, rather than being forced into the same taxonomy.

**Why:** Collector, Java Agent, and Python are each genuinely built differently (grouped by
component type, bundled as one tool, or distributed as independent packages), so forcing identical
taxonomies above the component level would misrepresent how each ecosystem actually works, while
diverging below that level would break the consistency users rely on to evaluate any component the
same way.

## GenAI-specific principles

GenAI libraries (e.g. LangChain, OpenAI Assistants, Pydantic AI) don't get their own ecosystem
branch. A GenAI library's actual content (Overview, Expected Telemetry, Conformance, Configuration,
Version History) lives under its native ecosystem, wherever that library actually belongs. The GenAI
entry point should function as a discovery and comparison layer rather than duplicating content that
already exists under an ecosystem branch. Conformance Comparison under GenAI is grouped by
convention, not by library. Add a new convention grouping when there is a meaningful need to compare
multiple conventions, rather than pre-building structures for hypothetical future conventions. Why:
One participant described genuine confusion navigating GenAI semantic conventions spread across
multiple repositories with no unifying view. Another wanted different platforms to consistently
align on the same conventions rather than reshaping them per vendor.
