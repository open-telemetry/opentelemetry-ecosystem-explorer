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
import { getI18n } from "react-i18next";
import type { InstrumentationData } from "@/types/javaagent";

export interface SemanticConventionInfo {
  label: string;
  url: string;
}

const SEMCONV_URLS: Record<string, string> = {
  HTTP_CLIENT_SPANS:
    "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-client-span",
  HTTP_SERVER_SPANS:
    "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server-span",
  HTTP_CLIENT_METRICS: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#http-client",
  HTTP_SERVER_METRICS: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#http-server",
  DATABASE_CLIENT_SPANS: "https://opentelemetry.io/docs/specs/semconv/database/database-spans/",
  DATABASE_CLIENT_METRICS: "https://opentelemetry.io/docs/specs/semconv/database/database-metrics/",
  DATABASE_POOL_METRICS:
    "https://opentelemetry.io/docs/specs/semconv/database/database-metrics/#connection-pools",
  MESSAGING_SPANS: "https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/",
  RPC_CLIENT_SPANS: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/",
  RPC_SERVER_SPANS: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/",
  RPC_CLIENT_METRICS: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/",
  RPC_SERVER_METRICS: "https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/",
  FAAS_SERVER_SPANS: "https://opentelemetry.io/docs/specs/semconv/faas/faas-spans/",
  GRAPHQL_SERVER_SPANS: "https://opentelemetry.io/docs/specs/semconv/graphql/graphql-spans/",
  GENAI_CLIENT_SPANS: "https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/",
  GENAI_CLIENT_METRICS: "https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/",
};

export function getSemanticConventionInfo(value: string): SemanticConventionInfo | null {
  const url = SEMCONV_URLS[value];
  if (!url) return null;
  return {
    label: getI18n().t(`format.semconv.${value}`, { ns: "java-agent" }),
    url,
  };
}

export interface FeatureInfo {
  label: string;
  description: string;
}

const FEATURE_KEYS = new Set([
  "HTTP_ROUTE",
  "CONTEXT_PROPAGATION",
  "AUTO_INSTRUMENTATION_SHIM",
  "CONTROLLER_SPANS",
  "VIEW_SPANS",
  "LOGGING_BRIDGE",
  "RESOURCE_DETECTOR",
]);

export function getFeatureInfo(value: string): FeatureInfo | null {
  if (!FEATURE_KEYS.has(value)) return null;
  return {
    label: getI18n().t(`format.feature.${value}.label`, { ns: "java-agent" }),
    description: getI18n().t(`format.feature.${value}.description`, { ns: "java-agent" }),
  };
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

export function getStabilityLabel(declarativeName: string): string | null {
  const idx = declarativeName.indexOf("/");
  if (idx === -1) return null;
  // The suffix may contain dots (e.g. "development.enabled") — take the segment up to the next dot
  const suffix = declarativeName.slice(idx + 1);
  const dot = suffix.indexOf(".");
  return dot === -1 ? suffix : suffix.slice(0, dot);
}

export function formatDeclarativeYaml(declarativeName: string, value: string): string {
  const baseName = declarativeName.includes("/")
    ? declarativeName.slice(0, declarativeName.indexOf("/"))
    : declarativeName;
  const parts = baseName.split(".");
  return parts
    .map((part, i) => `${"  ".repeat(i)}${part}:`)
    .join("\n")
    .replace(/:$/, `: ${value}`);
}
