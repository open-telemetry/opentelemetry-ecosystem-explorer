# User Interview Synthesis

Introduction Seven user interviews were conducted with professionals who use OpenTelemetry in
different capacities, including Software Engineers, Site Reliability Engineers (SREs), Software
Architect, and Observability specialists. Participants ranged from approximately one year of
OpenTelemetry experience to individuals responsible for enterprise-scale observability platforms and
internal tooling. This diversity provided insight into both day-to-day implementation challenges and
large-scale operational needs.

_Jay's session was a mock interview run by a project mentor to test the interview script, included
because it reflects genuine first-hand SRE experience._

## Key Findings

### 1. Finding information quickly is a common challenge

Across participants, the issue was rarely the absence of documentation but the time and effort
required to locate relevant information. Participants described documentation as comprehensive but
difficult to navigate, often requiring searches across multiple pages, repositories, or external
resources before finding the information they needed.

Evidence

- Seun described the documentation as "very bulky" and said Google was often the fastest way to
  reach the correct page instead of navigating the documentation directly.
- Logesh said the required information already exists but wanted a more powerful search experience
  to reach it more quickly.
- The Anonymous participant reported that the OpenTelemetry website search often required opening
  multiple pages before finding relevant information.
- Bernardo explained that navigating multiple repositories had become confusing and required
  maintaining numerous bookmarks.

### 2. Participants routinely combined multiple information sources rather than relying on a single one

No participant described relying exclusively on one source of information. Instead, they combined
official documentation with search engines, GitHub repositories, AI tools, blogs, community
channels, or colleagues depending on the task.

Evidence

- Seun began with Google before moving into the official documentation and consulted Stack Overflow
  only for edge cases.
- Tamen supplemented documentation with Grafana Slack, Discord, Reddit, and AI when additional
  context was needed.
- Bernardo relied on documentation, source code, Slack discussions, changelogs, and AI to understand
  breaking changes.
- The Anonymous participant combined the OpenTelemetry website with AI and Google, validating
  information across multiple sources before acting on it.
- Jay described moving from Datadog’s documentation to GitHub issues, pull requests, source code,
  and AI when documentation alone was insufficient.

### 3. Version-specific information influences implementation and version upgrade decisions

Several participants highlighted the importance of understanding differences between OpenTelemetry
versions, particularly when maintaining production systems or environments that are not always
running the latest release.

Evidence

- Seun wanted version-specific changes to be easier to identify to avoid implementing functionality
  already available in newer releases.
- Bernardo reported that brief changelogs made it difficult to assess downstream impact before
  upgrading production systems.
- Filipi explained that version-specific documentation was necessary because production environments
  do not always use the latest release.
- The Anonymous participant considered version-specific information critical because OpenTelemetry
  evolves rapidly.
- Jay also described difficulty determining whether documentation applied to the versions used
  within his organisation.

### 4. AI has become part of participants' workflows, but trust is established through verification rather than blind acceptance

Most participants reported using AI in some capacity, including troubleshooting, summarising
documentation, generating code, or explaining concepts. However, those who used AI also described
verifying responses against official documentation, source code, or previous experience before
relying on them.

Evidence

- Seun used AI for summaries and examples while checking responses against prior knowledge.
- Tamen used AI primarily for translating instrumentation logic across programming languages,
  generating code from pseudocode, and debugging subtle faults rather than discovering OpenTelemetry
  information.
- Bernardo described AI as a "rubber duck" for understanding documentation rather than a source of
  truth.
- Filipi started with AI but corrected responses using official documentation when necessary.
- The Anonymous participant relied heavily on AI but validated outputs across multiple sources,
  particularly for profiling guidance.
- Jay also emphasised verifying AI-generated information because it could confidently provide
  outdated or incorrect guidance.

### 5. Participants wanted more contextual guidance, not just technical reference material

Several participants requested documentation that explains implementation decisions, recommended
approaches, or expected outcomes rather than focusing solely on configuration.

Evidence

- Tamen wanted beginner-focused explanations describing why different instrumentation approaches
  exist, not only how to configure them.
- The Anonymous participant wanted recommended implementation patterns and enterprise deployment
  guidance alongside the existing documentation.
- Logesh wanted more reference architectures. Both to build internal buy-in and to get clearer
  guidance on deployment patterns, such as knowing that DaemonSet is the common choice for
  SaaS-style Collector deployments.
- Filipi preferred blog posts because they provide end-to-end context rather than isolated
  documentation pages.
- Jay wanted documentation to show the telemetry users should expect after implementation so they
  could determine whether instrumentation had been configured successfully.

### 6. How users configure instrumentation

Participants strongly preferred auto-instrumentation over manual instrumentation, reserving manual
work for cases requiring business-specific context, and configuration decisions were often driven by
minimizing burden on their team, not just technical fit.

Evidence

- Arpit standardized on auto-instrumentation across thousands of microservices specifically to avoid
  asking developers to manually instrument their own code, reserving manual instrumentation only for
  teams wanting to enrich spans with business context.
- Bernardo used separate Instrumentation custom resources for metrics-only versus
  metrics-and-traces, since different teams had different telemetry needs, and controlled rollout
  via annotations rather than code changes.
- Filipi's team used auto-instrumentation almost everywhere, with manual instrumentation needed in
  only one specific case (RabbitMQ) in an otherwise C-based codebase.
- Tamen built custom instrumentation libraries wrapping manual instrumentation logic so application
  teams could simply import a package and initialize it, rather than instrumenting manually
  themselves and exposed configuration through environment variables so behavior could change
  without code changes.
- Jay's biggest configuration frustration was that documentation shows how to turn instrumentation
  options on or off, but not what changes as a result. Leaving him to reverse-engineer source code
  to understand configuration impact.

### 7. How users choose between components

Component selection was typically driven by a combination of cost, relevance to actual
business/operational questions, and completeness. Users often only discovered whether a component
was truly a good fit after deploying it and observing the resulting telemetry, rather than through
documentation alone.

Evidence

- Tamen and Jay both evaluated components along the same two axes: whether the telemetry generated
  was worth its cost, and whether it was specific enough to answer real operational questions (e.g.,
  which database was called, in what context).
- Bernardo discovered mid-project that a more complete component existed (the Kubernetes objects
  receiver vs. the events receiver) only through a teammate's suggestion, and the team ultimately
  chose the less complete option specifically to avoid deploying capabilities they didn't yet need.
- Jay's Apache Camel case showed component selection breaking down entirely when official vendor
  documentation didn't clarify support level ("preview" status with no detail on limitations),
  forcing him to migrate that service to pure OpenTelemetry instrumentation instead.
- Arpit's team is still evaluating observability backends specifically because many vendors
  transform OpenTelemetry data into proprietary schemas, which would undermine component/tooling
  portability if chosen.

### Additional Observation: Deployment guidance emerged as a related but distinct need

Two participants raised deployment-related challenges, but from different perspectives. Logesh
wanted clearer guidance to help choose between Collector deployment models, such as DaemonSets,
sidecars, and StatefulSets, for different use cases. In contrast, the Anonymous participant focused
on enterprise implementation guidance, requesting recommended deployment patterns, best practices,
and reference architectures for Kubernetes environments, while describing a layered Collector
architecture used in practice. Although deployment decisions were not the primary focus of this
research, these interviews suggest that users may benefit from clearer deployment guidance alongside
component discovery.

## Implications for Future Work

These findings, together with an earlier
[competitive analysis](https://docs.google.com/presentation/d/1TmbkWO_OqBcm44pcZj_yCdYB32oTa2Pq-VTGFG8UxTY/edit?usp=sharing)
of similar tools (e.g., package registries and documentation sites), will inform an upcoming
Information Architecture recommendation. Rather than prescribing solutions here, this section
highlights areas that the research suggests could be worth exploring further.

- How can information currently spread across documentation, repositories, and release notes be made
  easier to locate and navigate?
- How can implementation guidance (expected telemetry outputs) sit alongside technical reference
  material, rather than requiring users to infer it?
- How should documentation be structured so AI tools can reliably and accurately answer questions
  about it, since several participants already treat AI as a first stop for component information?
- How should configuration options communicate their effect, so users don't need to reverse-engineer
  source code to understand what changes?
- How should version-to-version changes be surfaced so users can assess impact before upgrading?
