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
import { buildInstrumentationDefaultEntries } from "./instrumentation-default-entries";
import type { DeclarativeScope } from "./declarative-name";

const ALL_SCOPES: DeclarativeScope[] = ["general", "common", "owned"];

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

describe("buildInstrumentationDefaultEntries", () => {
  it("dedupes a shared common config across two modules into one entry", () => {
    const shared = {
      name: "otel.x",
      declarative_name: "java.common.http.known_methods",
      description: "",
      type: "list" as const,
      default: "GET,POST",
    };
    const modules = [
      makeModule("m1", [makeEntry("m1-1.0", [shared])]),
      makeModule("m2", [makeEntry("m2-1.0", [shared])]),
    ];
    const entries = buildInstrumentationDefaultEntries(modules, { includeScopes: ALL_SCOPES });
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toEqual([
      "instrumentation/development",
      "java",
      "common",
      "http",
      "known_methods",
    ]);
    expect(entries[0].value).toEqual(["GET", "POST"]);
  });

  it("honors includeScopes (owned-only excludes general/common)", () => {
    const modules = [
      makeModule("graphql_java", [
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
      ]),
    ];
    const owned = buildInstrumentationDefaultEntries(modules, { includeScopes: ["owned"] });
    expect(owned).toHaveLength(1);
    expect(owned[0].path).toEqual([
      "instrumentation/development",
      "java",
      "graphql",
      "capture_query",
    ]);

    const all = buildInstrumentationDefaultEntries(modules, { includeScopes: ALL_SCOPES });
    expect(all).toHaveLength(3);
  });

  it("maps each default through parseDefault per type", () => {
    const modules = [
      makeModule("m", [
        makeEntry("m-1.0", [
          {
            name: "b",
            declarative_name: "java.m.flag",
            description: "",
            type: "boolean",
            default: true,
          },
          {
            name: "l",
            declarative_name: "java.m.methods",
            description: "",
            type: "list",
            default: "a, b ,c",
          },
          {
            name: "mp",
            declarative_name: "java.m.headers",
            description: "",
            type: "map",
            default: "",
          },
        ]),
      ]),
    ];
    const entries = buildInstrumentationDefaultEntries(modules, { includeScopes: ALL_SCOPES });
    const byLeaf = Object.fromEntries(entries.map((e) => [e.path[e.path.length - 1], e.value]));
    expect(byLeaf.flag).toBe(true);
    expect(byLeaf.methods).toEqual(["a", "b", "c"]);
    expect(byLeaf.headers).toEqual({});
  });

  it("skips configs without a declarative_name", () => {
    const modules = [
      makeModule("m", [
        makeEntry("m-1.0", [
          {
            name: "otel.no.declarative",
            description: "env-var only",
            type: "boolean",
            default: false,
          },
        ]),
      ]),
    ];
    expect(buildInstrumentationDefaultEntries(modules, { includeScopes: ALL_SCOPES })).toEqual([]);
  });

  it("returns empty for no modules", () => {
    expect(buildInstrumentationDefaultEntries([], { includeScopes: ALL_SCOPES })).toEqual([]);
  });
});
