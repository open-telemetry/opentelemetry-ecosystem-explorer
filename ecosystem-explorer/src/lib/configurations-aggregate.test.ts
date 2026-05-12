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
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";
import { aggregateConfigurations } from "./configurations-aggregate";

function makeEntry(
  name: string,
  configs: InstrumentationData["configurations"]
): InstrumentationData {
  return {
    name,
    scope: { name: `io.opentelemetry.${name}` },
    configurations: configs,
  };
}

function makeModule(name: string, coveredEntries: InstrumentationData[]): InstrumentationModule {
  return { name, defaultDisabled: false, coveredEntries };
}

describe("aggregateConfigurations", () => {
  it("returns empty array when no covered entry has configurations", () => {
    const mod = makeModule("akka_actor", [makeEntry("akka-actor-2.3", undefined)]);
    expect(aggregateConfigurations(mod)).toEqual([]);
  });

  it("drops entries without declarative_name", () => {
    const mod = makeModule("akka_http", [
      makeEntry("akka-http-10.0", [
        {
          name: "otel.instrumentation.http.no-declarative",
          description: "env-var only",
          type: "boolean",
          default: false,
        },
        {
          name: "otel.instrumentation.http.known-methods",
          declarative_name: "java.common.http.known_methods",
          description: "Recognized methods",
          type: "list",
          default: "GET,POST",
        },
      ]),
    ]);
    const out = aggregateConfigurations(mod);
    expect(out).toHaveLength(1);
    expect(out[0].entry.declarative_name).toBe("java.common.http.known_methods");
  });

  it("dedupes by declarative_name, preferring the latest covered version", () => {
    const mod = makeModule("cassandra", [
      makeEntry("cassandra-3.0", [
        {
          name: "otel.x",
          declarative_name: "java.common.db.query_sanitization.enabled",
          description: "older description",
          type: "boolean",
          default: true,
        },
      ]),
      makeEntry("cassandra-4.4", [
        {
          name: "otel.x",
          declarative_name: "java.common.db.query_sanitization.enabled",
          description: "newer description",
          type: "boolean",
          default: true,
        },
      ]),
    ]);
    const out = aggregateConfigurations(mod);
    expect(out).toHaveLength(1);
    expect(out[0].entry.description).toBe("newer description");
  });

  it("orders general first, then java.common, then owned", () => {
    const mod = makeModule("graphql_java", [
      makeEntry("graphql-java-20.0", [
        {
          name: "owned-1",
          declarative_name: "java.graphql.capture_query",
          description: "",
          type: "boolean",
          default: true,
        },
        {
          name: "general-1",
          declarative_name: "general.http.server.request_captured_headers",
          description: "",
          type: "list",
          default: "",
        },
        {
          name: "common-1",
          declarative_name: "java.common.http.known_methods",
          description: "",
          type: "list",
          default: "",
        },
      ]),
    ]);
    const out = aggregateConfigurations(mod);
    expect(out.map((c) => c.scope)).toEqual(["general", "common", "owned"]);
  });

  it("populates path from declarative_name", () => {
    const mod = makeModule("graphql_java", [
      makeEntry("graphql-java-20.0", [
        {
          name: "owned-1",
          declarative_name: "java.graphql.capture_query",
          description: "",
          type: "boolean",
          default: true,
        },
      ]),
    ]);
    const out = aggregateConfigurations(mod);
    expect(out[0].path).toEqual([
      "instrumentation/development",
      "java",
      "graphql",
      "capture_query",
    ]);
  });
});
