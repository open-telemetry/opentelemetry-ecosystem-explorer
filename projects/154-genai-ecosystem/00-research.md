---
title: "Research — GenAI instrumentation landscape"
issue: 154
type: audit
phase: 1
status: in-progress
last_updated: "2026-05-08"
---

## Research — GenAI instrumentation landscape

---

## Python

Python has the most instrumentation coverage of any language right now. The bulk of it sits in
[opentelemetry-python-contrib](https://github.com/open-telemetry/opentelemetry-python-contrib), with
active third-party alternatives from Traceloop and Arize.

| Framework / SDK      | Library                                    | Type        | Signals               | Semconv notes                                                                                                                      |
| -------------------- | ------------------------------------------ | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Python SDK    | `opentelemetry-instrumentation-openai`     | Contrib     | Traces, Metrics       | Covers chat completions and embeddings. Emits `gen_ai.usage.*` token metrics. Missing tool-call span attributes.                   |
| Anthropic Python SDK | `opentelemetry-instrumentation-anthropic`  | Contrib     | Traces, Metrics       | Similar coverage to OpenAI instrumentation. Streaming support present but events are batched, not streamed per token.              |
| LangChain            | `opentelemetry-instrumentation-langchain`  | Contrib     | Traces                | Chain and LLM call spans. Tool execution spans exist but `gen_ai.tool.*` attributes aren't stable yet in semconv so naming varies. |
| LlamaIndex           | `opentelemetry-instrumentation-llamaindex` | Contrib     | Traces                | Query and retrieval spans. RAG pipeline tracing is functional but `gen_ai.retrieval.*` conventions are still experimental.         |
| LiteLLM              | Built-in LiteLLM callback                  | Native      | Traces, Metrics       | Covers 100+ providers through a single integration point. Attribute completeness varies by provider underneath.                    |
| Any Python LLM       | openllmetry (Traceloop)                    | Third-party | Traces, Metrics, Logs | Broader framework coverage than contrib alone. Uses OTel semconv where stable, custom attributes elsewhere.                        |
| Any Python LLM       | openinference (Arize)                      | Third-party | Traces                | `openinference-semantic-conventions` is a parallel convention set; not compatible with OTel GenAI semconv directly.                |

### Python observations

The contrib instrumentations for OpenAI and Anthropic are the most semconv-aligned. LangChain and
LlamaIndex tracing exists but the agentic/RAG parts of the convention are still in flux, so those
spans use a mix of stable and experimental attributes.

LiteLLM is the most practical unified entry point for multi-provider coverage, but because it
proxies everything through one interface, provider-specific response attributes can be lossy.

The Arize openinference conventions are a separate fork of the semantics; frameworks that adopted
openinference early (several LlamaIndex integrations, for example) don't map cleanly to OTel semconv
without a translation layer.

---

## JavaScript / TypeScript

Coverage here is thinner. The main OTel JS SDK has no GenAI-specific instrumentations in
opentelemetry-js-contrib yet. Most production usage goes through third-party libraries.

| Framework / SDK  | Library                                            | Type        | Signals         | Semconv notes                                                                                                                      |
| ---------------- | -------------------------------------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| LangChain.js     | `@traceloop/node-server-sdk` (openllmetry-js)      | Third-party | Traces, Metrics | Functional tracing for chains and LLM calls. Attribute coverage is reasonable for stable semconv; tool and agent spans are custom. |
| LangChain.js     | `@arizeai/openinference-instrumentation-langchain` | Third-party | Traces          | openinference semantics, not OTel GenAI semconv.                                                                                   |
| OpenAI JS SDK    | No dedicated instrumentation found                 | —           | —               | Manual instrumentation via `@opentelemetry/api` is the current path.                                                               |
| Vercel AI SDK    | No dedicated instrumentation found                 | —           | —               | Some users wrap with manual spans; no contrib library.                                                                             |
| Anthropic JS SDK | No dedicated instrumentation found                 | —           | —               | Same situation as OpenAI JS.                                                                                                       |

### JavaScript / TypeScript observations

The JS/TS gap is notable. There's no equivalent of the Python contrib instrumentations for the major
SDKs. openllmetry-js covers LangChain.js reasonably well, but direct OpenAI/Anthropic JS
instrumentation requires manual work.

This is probably the clearest gap for the ecosystem explorer to surface — users reaching for the
OpenAI JS SDK expecting plug-and-play instrumentation won't find a contrib solution today.

---

## Java

Java instrumentation for GenAI is rapidly evolving. The main
[opentelemetry-java-instrumentation](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
agent now includes dedicated support for major providers.

| Framework / SDK | Library                              | Type  | Signals         | Semconv notes                                                                            |
| --------------- | ------------------------------------ | ----- | --------------- | ---------------------------------------------------------------------------------------- |
| OpenAI Java SDK | `opentelemetry-java-instrumentation` | Agent | Traces, Metrics | Standardized GenAI client spans and metrics (token usage, model) following OTel semconv. |
| AWS Bedrock     | `opentelemetry-java-instrumentation` | Agent | Traces          | Supported via AWS SDK instrumentation. Captures inference spans.                         |
| LangChain4j     | No OTel instrumentation found        | —     | —               | Framework has its own observability hooks but no direct OTel bridge yet.                 |
| Spring AI       | No OTel instrumentation found        | —     | —               | Spring AI has Micrometer integration; an OTel bridge exists for Micrometer.              |

### Java observations

Java coverage is stronger than initially reported, with the official agent supporting OpenAI and
Bedrock (via the AWS SDK). While high-level frameworks like Spring AI and LangChain4j lack direct
OTel-native instrumentations, the underlying SDK support provides a solid foundation for capturing
standardized GenAI telemetry.

---

## .NET

.NET coverage is sparse. Microsoft Semantic Kernel is the dominant framework here.

| Framework / SDK | Library                                               | Type   | Signals | Semconv notes                                                                                                                                 |
| --------------- | ----------------------------------------------------- | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic Kernel | Built-in activity source (`Microsoft.SemanticKernel`) | Native | Traces  | Uses `System.Diagnostics.Activity`, compatible with OTel. Attribute naming predates the GenAI semconv; doesn't follow `gen_ai.*` conventions. |
| OpenAI .NET SDK | No dedicated OTel instrumentation found               | —      | —       | Similar to the JS situation.                                                                                                                  |

### .NET observations

Semantic Kernel is interesting — it does emit spans, and those spans flow into OTel collectors fine,
but the attribute names don't match the GenAI semconv. So you get traces but they don't interoperate
with dashboards built on `gen_ai.*` attributes.

---

## GenAI semantic conventions coverage

The [OTel GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) has a stable core and
an experimental section. Here's roughly how coverage maps:

### Stable attributes (generally well-adopted in contrib instrumentations)

- `gen_ai.system` — present in all Python contrib instrumentations
- `gen_ai.operation.name` — present (`chat`, `text_completion`, `embeddings`)
- `gen_ai.request.model` — present
- `gen_ai.response.model` — present where the API returns it
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` — present in Python contrib, missing in
  most JS and Java

### Experimental attributes (patchy adoption)

- `gen_ai.request.temperature`, `gen_ai.request.top_p`, `gen_ai.request.max_tokens` — present in
  OpenAI and Anthropic Python contrib, absent or inconsistent elsewhere
- `gen_ai.response.finish_reasons` — present in Python contrib
- `gen_ai.response.id` — present in OpenAI Python contrib, absent in others

### Not yet in most instrumentations

- `gen_ai.tool.*` — tool call spans exist in LangChain contrib but attribute names are custom
- Agent and RAG spans — conventions are still being drafted; implementations vary widely

---

## Patterns observed

**Provider-level vs. framework-level instrumentation.** Python contrib instruments at the SDK level
(OpenAI, Anthropic). LangChain and LlamaIndex instrumentations sit above that and emit
chain/workflow spans separately. This means a LangChain app using the OpenAI SDK can end up with
both sets of spans, which is usually useful but adds cardinality.

**Streaming support is inconsistently handled.** Most instrumentations batch streaming responses and
emit a single span when the stream closes. This is correct per the current semconv guidance but
means you can't observe time-to-first-token from spans alone.

**Third-party convention fragmentation.** openllmetry and openinference both fill real gaps but
their attribute naming diverges from each other and from OTel semconv in places. Someone building a
dashboard that queries `gen_ai.*` attributes won't get data from openinference-instrumented apps
without a mapping layer.

**Java and .NET are catching up.** The frameworks exist and are in production use. Java's official
agent now covers major SDKs, but higher-level framework integration (Spring AI, LangChain4j) is
still emerging. .NET remains focused on Semantic Kernel.

---

## Research conclusions

1. **Python is the reference implementation.** Any future registry schema for GenAI should be
   modeled after the Python contrib instrumentations, as they currently have the most complete
   mapping to OTel semantic conventions.
2. **The JS/TS gap is critical.** While Traceloop covers LangChain.js, there is no direct,
   low-dependency OTel-native way to instrument the OpenAI JS SDK. This is a major opportunity for
   the OpenTelemetry ecosystem.
3. **Java and .NET require framework-level research.** Since these ecosystems rely on Spring AI,
   LangChain4j, and Semantic Kernel, the focus should be on how these frameworks' native telemetry
   can be mapped or exported to OTel, supplementing the SDK-level instrumentation already present in
   Java.
4. **Semantic convention convergence is ongoing.** The "experimental" attributes (like temperature,
   top_p, and tool calls) are inconsistent. The
   [genai-otel-conformance](https://github.com/trask/genai-otel-conformance) project should be used
   as the primary benchmark for verifying future instrumentation support.

---

## Related resources

- [OTel GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [opentelemetry-python-contrib GenAI instrumentations](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation)
- [genai-otel-conformance](https://github.com/trask/genai-otel-conformance) — automated
  attribute-level coverage tests.
- [openllmetry](https://github.com/traceloop/openllmetry) (Traceloop)
- [openinference](https://github.com/Arize-ai/openinference) (Arize)
