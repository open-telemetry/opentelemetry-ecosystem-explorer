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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ConfigurationBuilderState } from "@/types/configuration-builder";
import type { InstrumentationModule } from "@/types/javaagent";

let mockState: ConfigurationBuilderState;

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({ state: mockState }),
}));

import { useOverriddenModules } from "./use-overridden-modules";

const baseState: ConfigurationBuilderState = {
  version: "1.0.0",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
};

function makeModule(name: string, declarativeNames: string[]): InstrumentationModule {
  return {
    name,
    defaultDisabled: false,
    coveredEntries: [
      {
        name: `${name}-x`,
        scope: { name: `io.opentelemetry.${name}` },
        configurations: declarativeNames.map((d) => ({
          name: "otel.x",
          declarative_name: d,
          description: "",
          type: "boolean",
          default: false,
        })),
      },
    ],
  };
}

describe("useOverriddenModules", () => {
  beforeEach(() => {
    mockState = { ...baseState, values: {} };
  });

  it("returns empty set when no overrides exist", () => {
    const { result } = renderHook(() => useOverriddenModules([]));
    expect(result.current.size).toBe(0);
  });

  it("includes modules in the enabled and disabled lists", () => {
    mockState.values = {
      distribution: {
        javaagent: {
          instrumentation: {
            enabled: ["tomcat", "spring_webmvc"],
            disabled: ["armeria_grpc"],
          },
        },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([]));
    expect([...result.current].sort()).toEqual(["armeria_grpc", "spring_webmvc", "tomcat"]);
  });

  it("flags a module by its name when an owned-scope path has a meaningful leaf", () => {
    const cassandra = makeModule("cassandra", ["java.cassandra.query_sanitization.enabled"]);
    mockState.values = {
      "instrumentation/development": {
        java: { cassandra: { query_sanitization: { enabled: false } } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([cassandra]));
    expect([...result.current]).toEqual(["cassandra"]);
  });

  it("flags kafka_clients when java.kafka.* has a meaningful leaf — names diverge from declarative segments", () => {
    const kafkaClients = makeModule("kafka_clients", ["java.kafka.producer_propagation.enabled"]);
    mockState.values = {
      "instrumentation/development": {
        java: { kafka: { producer_propagation: { enabled: false } } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([kafkaClients]));
    expect([...result.current]).toEqual(["kafka_clients"]);
  });

  it("ignores java.common writes — shared scope flags no row", () => {
    const akkaHttp = makeModule("akka_http", ["java.common.http.known_methods"]);
    mockState.values = {
      "instrumentation/development": {
        java: { common: { http: { known_methods: ["GET"] } } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([akkaHttp]));
    expect(result.current.size).toBe(0);
  });

  it("ignores general.* writes — shared scope flags no row", () => {
    const akkaHttp = makeModule("akka_http", ["general.http.server.request_captured_headers"]);
    mockState.values = {
      "instrumentation/development": {
        general: { http: { server: { request_captured_headers: ["X-Foo"] } } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([akkaHttp]));
    expect(result.current.size).toBe(0);
  });

  it("ignores empty subtrees left behind by removeMapEntry", () => {
    const cassandra = makeModule("cassandra", ["java.cassandra.query_sanitization.enabled"]);
    mockState.values = {
      "instrumentation/development": {
        java: { cassandra: { query_sanitization: {} } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([cassandra]));
    expect(result.current.size).toBe(0);
  });

  it("unions enabled-state and config-level overrides", () => {
    const cassandra = makeModule("cassandra", ["java.cassandra.query_sanitization.enabled"]);
    mockState.values = {
      distribution: {
        javaagent: { instrumentation: { enabled: ["tomcat"] } },
      },
      "instrumentation/development": {
        java: { cassandra: { query_sanitization: { enabled: false } } },
      },
    };
    const { result } = renderHook(() => useOverriddenModules([cassandra]));
    expect([...result.current].sort()).toEqual(["cassandra", "tomcat"]);
  });

  it("does not flag a module whose owned paths are absent from values", () => {
    const cassandra = makeModule("cassandra", ["java.cassandra.query_sanitization.enabled"]);
    mockState.values = {
      "instrumentation/development": { java: { graphql: { capture_query: true } } },
    };
    const { result } = renderHook(() => useOverriddenModules([cassandra]));
    expect(result.current.size).toBe(0);
  });
});
