/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { InstrumentationData } from "@/types/javaagent";

export interface SemanticConventionInfo {
  label: string;
  url: string;
}

const SEMANTIC_CONVENTION_MAP: Record<string, SemanticConventionInfo> = {
  HTTP_CLIENT_SPANS: {
    label: "HTTP Client Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-client",
  },
  HTTP_SERVER_SPANS: {
    label: "HTTP Server Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server",
  },
  HTTP_CLIENT_METRICS: {
    label: "HTTP Client Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#http-client",
  },
  HTTP_SERVER_METRICS: {
    label: "HTTP Server Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#http-server",
  },
  HTTP_ROUTE: {
    label: "HTTP Route",
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-spans/",
  },
  DATABASE_CLIENT_SPANS: {
    label: "Database Client Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/database/database-spans/",
  },
  DATABASE_CLIENT_METRICS: {
    label: "Database Client Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/database/database-metrics/",
  },
  DATABASE_POOL_METRICS: {
    label: "Database Pool Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/database/database-metrics/#connection-pools",
  },
  MESSAGING_SPANS: {
    label: "Messaging Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/",
  },
  RPC_CLIENT_SPANS: {
    label: "RPC Client Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/",
  },
  RPC_SERVER_SPANS: {
    label: "RPC Server Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/",
  },
  RPC_CLIENT_METRICS: {
    label: "RPC Client Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/",
  },
  RPC_SERVER_METRICS: {
    label: "RPC Server Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/",
  },
  FAAS_SERVER_SPANS: {
    label: "FaaS Server Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/faas/faas-spans/",
  },
  GRAPHQL_SERVER_SPANS: {
    label: "GraphQL Server Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/graphql/graphql-spans/",
  },
  GENAI_CLIENT_SPANS: {
    label: "GenAI Client Spans",
    url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/",
  },
  GENAI_CLIENT_METRICS: {
    label: "GenAI Client Metrics",
    url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/",
  },
  CONTEXT_PROPAGATION: {
    label: "Context Propagation",
    url: "https://opentelemetry.io/docs/specs/otel/context/api-propagators/",
  },
  AUTO_INSTRUMENTATION_SHIM: {
    label: "Auto Instrumentation Shim",
    url: "https://opentelemetry.io/docs/specs/otel/trace/api/",
  },
};

export function getSemanticConventionInfo(value: string): SemanticConventionInfo | null {
  return SEMANTIC_CONVENTION_MAP[value] ?? null;
}

export function getInstrumentationDisplayName(instrumentation: InstrumentationData): string {
  if (instrumentation.display_name) {
    return instrumentation.display_name;
  }

  let name = instrumentation.name;

  name = name.replace(/-\d+\.\d+.*$/, "");

  name = name.replace(/-/g, " ");

  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return name;
}
