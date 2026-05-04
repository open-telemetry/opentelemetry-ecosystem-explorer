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
import { describe, it, expect } from "vitest";
import {
  getInstrumentationDisplayName,
  getSemanticConventionInfo,
  getFeatureInfo,
  getStabilityLabel,
  formatDeclarativeYaml,
} from "./format";
import type { InstrumentationData } from "@/types/javaagent";

describe("getInstrumentationDisplayName", () => {
  it("returns display_name when provided", () => {
    const instrumentation: InstrumentationData = {
      name: "jdbc-2.0.0",
      display_name: "JDBC Database",
      scope: { name: "jdbc" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("JDBC Database");
  });

  it("formats name by stripping version from end", () => {
    const instrumentation: InstrumentationData = {
      name: "spring-web-1.0.0",
      scope: { name: "spring" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Spring Web");
  });

  it("formats name by converting dashes to spaces", () => {
    const instrumentation: InstrumentationData = {
      name: "http-client",
      scope: { name: "http" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Http Client");
  });

  it("formats name by capitalizing first letter", () => {
    const instrumentation: InstrumentationData = {
      name: "kafka",
      scope: { name: "kafka" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Kafka");
  });

  it("handles complex version suffixes", () => {
    const instrumentation: InstrumentationData = {
      name: "redis-client-3.2.1-alpha",
      scope: { name: "redis" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Redis Client");
  });

  it("handles names without versions", () => {
    const instrumentation: InstrumentationData = {
      name: "mongo-db",
      scope: { name: "mongo" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Mongo Db");
  });

  it("handles single word names", () => {
    const instrumentation: InstrumentationData = {
      name: "jdbc",
      scope: { name: "jdbc" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Jdbc");
  });
});

describe("getSemanticConventionInfo", () => {
  it("returns label and url for a known value", () => {
    const info = getSemanticConventionInfo("HTTP_CLIENT_SPANS");
    expect(info).toEqual({
      label: "HTTP Client Spans",
      url: "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-client-span",
    });
  });

  it("returns label and url for DATABASE_CLIENT_SPANS", () => {
    const info = getSemanticConventionInfo("DATABASE_CLIENT_SPANS");
    expect(info).toEqual({
      label: "Database Client Spans",
      url: "https://opentelemetry.io/docs/specs/semconv/database/database-spans/",
    });
  });

  it("returns label and url for MESSAGING_SPANS", () => {
    const info = getSemanticConventionInfo("MESSAGING_SPANS");
    expect(info).toEqual({
      label: "Messaging Spans",
      url: "https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/",
    });
  });

  it("returns label and url for GENAI_CLIENT_SPANS", () => {
    const info = getSemanticConventionInfo("GENAI_CLIENT_SPANS");
    expect(info).toEqual({
      label: "GenAI Client Spans",
      url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/",
    });
  });

  it("returns null for an unknown value", () => {
    expect(getSemanticConventionInfo("UNKNOWN_CONVENTION")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getSemanticConventionInfo("")).toBeNull();
  });
});

describe("getFeatureInfo", () => {
  it("returns label and description for a known value", () => {
    const info = getFeatureInfo("LOGGING_BRIDGE");
    expect(info).toEqual({
      label: "Logging Bridge",
      description:
        "Bridges logging framework events to the OpenTelemetry Logs API, emitting log records from standard logging frameworks.",
    });
  });

  it("returns label and description for HTTP_ROUTE", () => {
    const info = getFeatureInfo("HTTP_ROUTE");
    expect(info).toEqual({
      label: "HTTP Route",
      description: "Enriches HTTP spans with route information.",
    });
  });

  it("returns label and description for RESOURCE_DETECTOR", () => {
    const info = getFeatureInfo("RESOURCE_DETECTOR");
    expect(info).toEqual({
      label: "Resource Detector",
      description: "Sets resource attributes based on certain conditions.",
    });
  });

  it("returns null for an unknown value", () => {
    expect(getFeatureInfo("UNKNOWN_FEATURE")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getFeatureInfo("")).toBeNull();
  });
});

describe("getStabilityLabel", () => {
  it("returns null when no slash is present", () => {
    expect(getStabilityLabel("java.common.http.known_methods")).toBeNull();
  });

  it("returns the suffix after the slash", () => {
    expect(
      getStabilityLabel("java.common.http.client.emit_experimental_telemetry/development")
    ).toBe("development");
  });

  it("strips any segment after the first dot in the suffix", () => {
    expect(getStabilityLabel("java.common.messaging.receive_telemetry/development.enabled")).toBe(
      "development"
    );
  });

  it("returns empty string when slash is the last character", () => {
    expect(getStabilityLabel("foo/")).toBe("");
  });
});

describe("formatDeclarativeYaml", () => {
  it("formats a single-segment name", () => {
    expect(formatDeclarativeYaml("foo", "<value>")).toBe("foo: <value>");
  });

  it("formats a multi-segment dotted path with nested indentation", () => {
    expect(formatDeclarativeYaml("java.common.http.known_methods", "<value>")).toBe(
      "java:\n  common:\n    http:\n      known_methods: <value>"
    );
  });

  it("strips the stability suffix before formatting", () => {
    expect(
      formatDeclarativeYaml(
        "java.common.http.client.emit_experimental_telemetry/development",
        "<value>"
      )
    ).toBe(
      "java:\n  common:\n    http:\n      client:\n        emit_experimental_telemetry: <value>"
    );
  });
});
