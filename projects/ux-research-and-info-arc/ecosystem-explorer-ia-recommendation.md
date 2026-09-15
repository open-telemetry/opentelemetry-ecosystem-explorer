# Ecosystem Explorer — IA Recommendation

The Ecosystem Explorer needs an information architecture that can scale beyond the current Java Agent and Collector experiences to support multiple OpenTelemetry ecosystems, including Python and JavaScript.

### Research inputs

- [Competitive analysis](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/blob/main/projects/ux-research-and-info-arc/comp-analysis.md)
- [Interview synthesis](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/blob/main/projects/ux-research-and-info-arc/user-interview-synthesis.md)
- [Multi-language Ecosystem explorer](https://deploy-preview-870--otel-ecosystem-explorer.netlify.app/)

### Key user needs

From user interview synthesis: Users need a fast and reliable way to find relevant information, understand what has changed or is newly available, determine how it applies to their situation, and verify that their implementation is working, without having to piece the information together across multiple sources.

### Mapping Research Findings to IA Considerations

This captures my thought process as I move from the [competitive analysis](https://docs.google.com/presentation/d/1TmbkWO_OqBcm44pcZj_yCdYB32oTa2Pq-VTGFG8UxTY/edit?usp=sharing) and the user research toward an Information Architecture recommendation for the Ecosystem Explorer. I’m using the competitive patterns, research findings, and the updated Explorer as inputs to identify IA requirements, questions, and opportunities before developing the proposed IA.

| **User Research** | **Competitive Analysis** | [**Updated Explorer**](https://deploy-preview-870--otel-ecosystem-explorer.netlify.app/) | **IA Question** |
|---|---|---|---|
| Finding information is difficult | Search is a primary discovery pattern | Explorer has search/filtering | Is search sufficient as a primary discovery mechanism? |
| Version-specific information affects implementation | Version history/comparison is common | Explorer has version exploration | How prominent should version be in the IA? |
| Users need expected telemetry | Metadata/detail information helps evaluation | Explorer already exposes telemetry | How should telemetry relate to instrumentation? |
| Configuration effects are unclear | Detail pages commonly organize technical info | Explorer has configuration | How should configuration information be organized so users can understand its effect? |
| Users use multiple information sources | Documentation integrated with package information | Explorer links to documentation/source | How much should Explorer consolidate vs. link out? |

### Initial Observation

The updated Ecosystem Explorer provides multiple entry points for discovery, including search, ecosystems, signals, components, and recent activity.

### Ecosystem Structure Analysis

To understand how the existing ecosystems are structured within the Explorer, I mapped the current information hierarchy for the OpenTelemetry Collector and Java Agent.
![Current Ecosystem Structure Analysis](./images/Current%20Ecosystem%20Structure%20Analysis%20(1).png)

Based on the user research and ecosystem structure analysis, the following IA considerations emerged:

**Ecosystem as a key discovery path:** As the Explorer expands to support more ecosystems, language/ecosystem can provide a key way for users to begin exploring ecosystem content.

**Ecosystem differences:** The IA should account for differences in how ecosystems group and describe their components or instrumentation, while maintaining consistency in shared concepts and information where appropriate.

**Shared information needs:** The research identified recurring information areas, such as version, configuration, telemetry, and related resources, that may be relevant when users explore individual components or instrumentation. The specific information presented should remain adaptable to each ecosystem.

**Contextual information:** Information such as version, compatibility, configuration, and relevant resources should be available where applicable to help users understand and use a component or instrumentation.

Given these considerations, what IA direction am I proposing?

### Resolving the IA Questions

**Is search sufficient as a primary discovery mechanism?** Not necessarily. Search should remain important, but shouldn't be the only discovery path. Two participants described finding components through community channels rather than search, since they couldn't search for something they didn't know existed. The updated Explorer already offers multiple paths, including search, ecosystems, signals, components, and recent activity.

**How prominent should versioning be in the IA?** High. Competitors treat version as core metadata, and it mattered to 5 of 7 research participants. It should stay a top-level element across all ecosystems, not just Collector and Java Agent.

**Telemetry visibility during evaluation: how should expected telemetry relate to instrumentation before it's implemented?** No competitor shows this well, so it's an opportunity area. Users want to see expected output before implementing, to judge fit and later confirm success. It should surface at evaluation, for example as a condensed preview in listings and search results, not only inside detail pages.

**Configuration to outcome mapping: how should configuration be organized so users understand its effect?** Also underserved by competitors, who present configuration as static reference. Users want to know what a setting actually changes about the output, so configuration options should be paired with their expected effect where possible.

**How much should Explorer consolidate vs. link out?** Consolidate evaluative information (version, expected telemetry, configuration effects); link out for deep documentation and source. This matches both competitor patterns and the research: users want a faster starting point, not a replacement for their other sources.

### Additional Consideration

I added Semantic Convention Conformance as suggested by one of my mentors, Jay. It tells the user how much of the official convention a specific library actually implements, helping them get a clearer picture of a library's reliability before committing to it. While this wasn't something my interview questions directly asked about, two participants' experiences independently reinforced its value: one described genuine confusion navigating GenAI semantic conventions across multiple repositories, and another described wanting different observability platforms to align consistently on the same conventions.

This also surfaced a related question: how should conformance work for GenAI libraries specifically, since they often span multiple ecosystems rather than living neatly under a single one? That question is resolved below, as part of the IA Recommendation.

### IA Recommendation

The proposed IA has two layers: a shared shell at the top, and ecosystem-specific structure underneath.

The shell consists of four entry points: Search, Ecosystems, Signals, and Recent Activities, largely unchanged from the [Current Explorer](https://deploy-preview-870--otel-ecosystem-explorer.netlify.app/).


Within Ecosystems, each language or tool (currently Collector, Java Agent, and Python) organizes its own top-level taxonomy differently, reflecting genuine technical differences: Collector groups by component type, Java Agent is a single bundled tool containing many instrumentations, and Python is composed of dozens of independently versioned packages.

However, once a user reaches an individual component, regardless of ecosystem, the structure converges on the same five nodes, in the same order: Overview, Expected Telemetry, Semantic Convention Conformance, Configuration, and Version History.

This is the core principle: the same structure, expressed in different language depending on how each ecosystem is actually built. The evaluation experience stays consistent no matter which ecosystem a user is in, while the taxonomy above it adapts to real technical differences rather than forcing a false uniformity. This is also what makes the structure scalable: a new ecosystem, such as JavaScript, only needs to map its own taxonomy into the same five nodes, rather than requiring a new page design from scratch.

A fifth entry point, GenAI, sits alongside the shell for a specific reason: GenAI libraries like LangChain, OpenAI Assistants, and Pydantic AI often span multiple ecosystems rather than living under one. GenAI provides a Conformance Comparison view, grouped by convention, that lets users compare these libraries side by side, then routes them into their existing page under whichever ecosystem they actually belong to (currently Python), rather than duplicating content. This keeps the five-node structure fully intact while addressing a real, cross-cutting discovery need.

![IA Recommendation](./images/Recommended%20IA%20(Updated).png)

See [Proposed Information Architecture](https://www.figma.com/design/0Bnemn8qO6XayQwmyYbB87/Ecosystem-IA?node-id=255-664&t=vlBqAWQcMNiLXWMy-1) on Figma.
