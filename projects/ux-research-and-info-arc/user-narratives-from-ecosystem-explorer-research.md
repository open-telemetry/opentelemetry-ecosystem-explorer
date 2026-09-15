---
title: "User Stories from the Ecosystem Explorer Research"
issue: 309
type: brief
phase: 1
status: in-progress
last_updated: "2026-09-07"
---

# User Narratives from the Ecosystem Explorer Research

These stories are drawn from seven one-on-one user interviews conducted for the Ecosystem Explorer
project — a platform designed to help developers discover and understand OpenTelemetry components.
Participants are identified by role only.

## The developer who traded a wasted PR for a lesson about checking versions first

A senior backend developer, deeply experienced with OpenTelemetry since 2023, described a moment
that stuck with him: a teammate opened an old GitHub issue asking for a specific environment
variable to be recorded manually. He started building it, only for someone to point out that a newer
OpenTelemetry release already captured that data automatically, no manual work needed. In his own
words, it "was just like a wasted effort on the PR." His takeaway was direct: it's "always important
to also check logs and see the version of what you're working on, because changes are always"
happening. Seperately, On search, he echoed a pattern several others described too: "documentation
might be very very bulky. So Google kind of streamlines it to where I meant to go." When AI came up,
he described using it the way he used to use Google, asking a direct question and getting a
synthesized answer with examples rather than a pile of links to sort through himself.

## The SRE who found tools through community

A senior SRE running an enterprise migration off several commercial observability vendors described
relying on a vendor open-source Slack, a few Discord servers, and Reddit whenever the official docs
came up short. He discovered one genuinely useful tool, an OpenTelemetry injector, simply because
someone happened to post about it on LinkedIn, not because anything official surfaced it. His own
summary of the pattern: "Until you don't go in there, you will never be able to find the new
things." He put it plainly elsewhere too: OpenTelemetry, in his words, "is slowly gaining a
reputation like Kubernetes," something that feels enormous and intimidating from the outside, but
becomes intuitive once you're actually in it. His frustration wasn't with how to auto- or
manual-instrument, but with why: "Why are we auto instrumenting? Why are we manual instrumenting?
What is actually going on? ... That is hard to find." He was also the clearest counterexample on AI
trust: he reported that the latest AI models rarely steer him wrong anymore on OpenTelemetry tasks,
especially when he gives them his own working code as context, a sharp contrast to how most other
participants described AI.

## The Observability Architect navigating inconsistent OTel docs

An observability architect at a large financial services company described a specific, repeatable
pattern: when he asks different tools about environment variables for OpenTelemetry's newer
profiling signal, he gets different answers depending on which tool he asks, and sometimes the
answer even seems to shift depending on which vendor contributed that part of the documentation. His
own description: "sometimes pick the environment variable based on the contributors, also it is very
hallucinating." His workaround is to never trust a single source: he checks the OpenTelemetry
website, an AI copilot, and a plain Google search, and only trusts an answer once two or three
sources agree. He was also candid about the official site's own limitations: "if I go to the
OpenTelemetry website, if I'm searching something it's not very detailed. If it can give the same
experience like an AI, that will be very good." Separately, he described a real architectural
decision with no clear guidance in the docs: choosing between an Operator-managed setup or a
sidecar-based one for Kubernetes deployments, something he had to work out through his own
engineering effort rather than a documented recommendation. He also raised a related, broader wish:
that different observability platforms would "align to the same semantic convention" instead of each
reshaping OpenTelemetry data into its own schema, so switching backends wouldn't mean losing the
benefit of a shared standard.

## The engineer who trusts blog posts more than official docs

An SRE about a year into the role, described leaning on AI for step-by-step troubleshooting more
than reading documentation directly, but was quick to add that AI sometimes gets it wrong, at which
point he goes back to the actual docs himself to correct it. Asked which sources he actually
prefers, his answer was clear: "I prefer different sources but I like the most blog posts because
they have a context, they start with one point and go through other points more smoothly." His
process before trusting anything in production is hands-on: he deploys locally, runs test traffic
against it, confirms it behaves as expected, and only then promotes it toward production.

## The architect who wants OTel's search to work like a real search engine

A software architect at a large enterprise data platform company described a specific frustration
with the OpenTelemetry site's search: it doesn't function like a real search engine, it just returns
whole pages to click through one at a time. "That one single search bar doesn't take it like a
full-fledged search... the bottom level content is not searchable... the free form search would have
been much helpful." He also described real friction the first time he had to choose a Collector
deployment pattern, pod, sidecar, DaemonSet, or StatefulSet, with no clear guidance on which fits
which situation, calling it "not a cakewalk" to work out on his own.

## The SRE whose actions didn't match his own review of the docs

An SRE on an observability team at a large retail company rated the documentation and contrib
repository as "quite good enough" when asked directly. But the way he actually works tells a
different story: he described keeping a large personal collection of bookmarks just to navigate
between the collector core repo, the contrib repo, and separate release notes, because, in his
words, "sometimes I get confused with many repos." He uses AI specifically as a "rubber duck" to
understand breaking changes before shipping a new collector version to customers whose dashboards
depend on stable field names. He also candidly revised his own self-assessed OpenTelemetry expertise
downward, from a 6 or 7 out of 10 to a 3 or 4, after attending a conference that showed him how much
more there was to know. Two separate moments captured how much discovery depends on accident rather
than documentation: he only learned OpenTelemetry's contrib repo already had an SNMP receiver after
a conversation with someone who'd built his own from scratch, and he only found a more complete
Kubernetes Objects receiver because a teammate happened to bring it up mid-project, after they'd
already started building with a less complete one. He also noted plainly that "the changelogs are
not descriptive enough" when it comes to understanding what changed between releases. When shown the
Java agent's release-comparison feature for the first time during the interview, his reaction was
immediate: "that will be very useful to us," enough that he said he planned to show it to his own
team afterward. He described a similar disorientation with GenAI specifically: "the genai got its
own repo for Java things... sometimes I get confused with many repos," navigating semantic
conventions that live in different places depending on the ecosystem.

## The SRE who watched Ecosystem Explorer answer in seconds what took him a longer time to figure out without it

A site reliability engineer supporting over 100 engineering teams spent real time trying to close an
observability gap: services built on Apache Camel weren't producing connected traces or any metrics,
and his primary vendor's own compatibility page listed Camel support only as "preview," with a note
that "distributed trace propagation over camel routes is not supported" and no explanation of
workarounds or timeline. He worked through the vendor's docs, then GitHub issues and pull requests
looking for anyone who'd solved it, then the vendor's own support team, and still came up short. His
summary of the whole ordeal: "I wasn't even sure what success looked like concretely." He eventually
stripped the vendor's Java agent out of that service entirely and ran pure OpenTelemetry instead,
since its support for Camel turned out to be meaningfully better. He also described asking ChatGPT
directly what his vendor's Java APM instrumentation provides for Apache Camel, and it confidently
answered that context propagation over routes was supported and preserved parent-child span
relationships. It was completely wrong, the opposite of what he'd already confirmed through his own
testing and the vendor's own documentation. When shown the Ecosystem Explorer prototype, he looked
up Camel himself, the contrast was immediate: within moments he could see which Camel version was
supported, which spans and attributes to expect, which configuration flags changed that output, and
what had changed across recent releases, the exact picture that had taken him weeks of digging, dead
ends, and a wrong AI answer to piece together the first time. His parting reflection captured the
core need behind the whole project: "it would be great if I could tell my local AI agent to use this
page as a source, because it seems like it has all the information I want."

## Why these stories matter together

No single story here is the whole picture. Each one reflects a different angle on how people
actually find and use OpenTelemetry information; some of the patterns these stories illustrate are
explored more fully in the
[Interview Synthesis](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/blob/main/projects/ux-research-and-info-arc/user-interview-synthesis.md),
which covers the research findings from all seven user interviews.
