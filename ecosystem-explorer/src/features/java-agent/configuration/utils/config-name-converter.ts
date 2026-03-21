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

const SPECIAL_MAPPINGS_REVERSE: Record<string, string> = {
  "otel.instrumentation.http.client.capture-request-headers":
    "general.http.client.request_captured_headers",
  "otel.instrumentation.http.client.capture-response-headers":
    "general.http.client.response_captured_headers",
  "otel.instrumentation.http.server.capture-request-headers":
    "general.http.server.request_captured_headers",
  "otel.instrumentation.http.server.capture-response-headers":
    "general.http.server.response_captured_headers",
  "otel.instrumentation.http.known-methods": "java.common.http.known_methods",
  "otel.instrumentation.http.client.experimental.redact-query-parameters":
    "java.common.http.client.redact_query_parameters/development",
  "otel.instrumentation.http.client.emit-experimental-telemetry":
    "java.common.http.client.emit_experimental_telemetry/development",
  "otel.instrumentation.http.server.emit-experimental-telemetry":
    "java.common.http.server.emit_experimental_telemetry/development",
  "otel.instrumentation.common.db-statement-sanitizer.enabled":
    "java.common.database.statement_sanitizer.enabled",
  "otel.instrumentation.common.experimental.db-sqlcommenter.enabled":
    "java.common.database.sqlcommenter/development.enabled",
  "otel.instrumentation.messaging.experimental.receive-telemetry.enabled":
    "java.common.messaging.receive_telemetry/development.enabled",
  "otel.instrumentation.messaging.experimental.capture-headers":
    "java.common.messaging.capture_headers/development",
  "otel.instrumentation.genai.capture-message-content":
    "java.common.gen_ai.capture_message_content",
  "otel.instrumentation.experimental.span-suppression-strategy":
    "java.common.span_suppression_strategy/development",
  "otel.instrumentation.opentelemetry-annotations.exclude-methods":
    "java.opentelemetry_extension_annotations.exclude_methods",
  "otel.semconv-stability.opt-in": "general.semconv_stability.opt_in",
};

export function flatToDeclarative(flatProp: string): string {
  const specialMapping = SPECIAL_MAPPINGS_REVERSE[flatProp];
  if (specialMapping) {
    if (specialMapping.startsWith("java.")) {
      return `instrumentation.${specialMapping}`;
    }
    return specialMapping;
  }

  if (!flatProp.startsWith("otel.instrumentation.")) {
    return flatProp;
  }

  let path = flatProp.substring("otel.instrumentation.".length);

  const segments = path.split(".");
  const convertedSegments = segments.map((segment) => {
    if (segment.startsWith("experimental-")) {
      const withoutExp = segment.replace(/^experimental-/, "");
      return withoutExp ? `${withoutExp}/development` : "experimental/development";
    } else if (segment === "experimental") {
      return "experimental/development";
    }
    return segment;
  });

  path = convertedSegments.join(".").replace(/-/g, "_");

  return `instrumentation.java.${path}`;
}

export function declarativeToFlat(declarativePath: string): string {
  const reverseMapping = Object.entries(SPECIAL_MAPPINGS_REVERSE).find(
    ([_, declarative]) =>
      declarative === declarativePath || `instrumentation.${declarative}` === declarativePath
  );
  if (reverseMapping) {
    return reverseMapping[0];
  }

  if (declarativePath.startsWith("instrumentation.java.")) {
    let path = declarativePath.substring("instrumentation.java.".length);

    path = path.replace(/\/development/g, "");

    const segments = path.split(".");
    const convertedSegments = segments.map((segment) => {
      return segment.replace(/_/g, "-");
    });

    return `otel.instrumentation.${convertedSegments.join(".")}`;
  }

  return declarativePath;
}

export function flatToShellVar(flatProp: string): string {
  return flatProp.replace(/\./g, "_").replace(/-/g, "_").toUpperCase();
}
