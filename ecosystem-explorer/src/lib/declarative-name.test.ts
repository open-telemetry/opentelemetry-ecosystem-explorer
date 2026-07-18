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
import { classifyScope, toValuePath, parseDefault } from "./declarative-name";

describe("classifyScope", () => {
  it("returns 'general' for a name leading with general.", () => {
    expect(classifyScope("general.http.server.request_captured_headers")).toBe("general");
  });

  it("returns 'common' for a name leading with java.common.", () => {
    expect(classifyScope("java.common.http.known_methods")).toBe("common");
  });

  it("returns 'owned' for any other java.<id>.* name", () => {
    expect(classifyScope("java.cassandra.query_sanitization.enabled")).toBe("owned");
    expect(classifyScope("java.graphql.capture_query")).toBe("owned");
  });

  it("returns 'owned' as a safe default for unexpected shapes", () => {
    expect(classifyScope("")).toBe("owned");
    expect(classifyScope("nodots")).toBe("owned");
  });
});

describe("toValuePath", () => {
  it("prepends instrumentation/development and splits on dots", () => {
    expect(toValuePath("java.cassandra.query_sanitization.enabled")).toEqual([
      "instrumentation/development",
      "java",
      "cassandra",
      "query_sanitization",
      "enabled",
    ]);
  });

  it("preserves /development inside a single segment when at the leaf", () => {
    expect(toValuePath("java.aws_sdk.experimental_span_attributes/development")).toEqual([
      "instrumentation/development",
      "java",
      "aws_sdk",
      "experimental_span_attributes/development",
    ]);
  });

  it("preserves /development as a single mid-path segment", () => {
    expect(toValuePath("java.common.controller_telemetry/development.enabled")).toEqual([
      "instrumentation/development",
      "java",
      "common",
      "controller_telemetry/development",
      "enabled",
    ]);
  });

  it("handles general.* paths the same way", () => {
    expect(toValuePath("general.http.server.request_captured_headers")).toEqual([
      "instrumentation/development",
      "general",
      "http",
      "server",
      "request_captured_headers",
    ]);
  });
});

describe("parseDefault", () => {
  it("returns the boolean as-is", () => {
    expect(parseDefault("boolean", true)).toBe(true);
    expect(parseDefault("boolean", false)).toBe(false);
  });

  it("returns strings unchanged", () => {
    expect(parseDefault("string", "hello")).toBe("hello");
    expect(parseDefault("string", "")).toBe("");
  });

  it("coerces int / double via Number", () => {
    expect(parseDefault("int", 5000)).toBe(5000);
    expect(parseDefault("int", "5000")).toBe(5000);
    expect(parseDefault("double", "1.5")).toBe(1.5);
  });

  it("splits CSV defaults for list", () => {
    expect(parseDefault("list", "CONNECT,DELETE,GET")).toEqual(["CONNECT", "DELETE", "GET"]);
  });

  it("treats empty-string list default as an empty array", () => {
    expect(parseDefault("list", "")).toEqual([]);
  });

  it("returns an empty object for empty map default", () => {
    expect(parseDefault("map", "")).toEqual({});
  });

  it("parses key=value pairs for map default", () => {
    expect(parseDefault("map", "host1=serviceA,host2=serviceB")).toEqual({
      host1: "serviceA",
      host2: "serviceB",
    });
  });

  it("trims whitespace around keys and values in map default", () => {
    expect(parseDefault("map", " host1 = serviceA , host2 = serviceB ")).toEqual({
      host1: "serviceA",
      host2: "serviceB",
    });
  });

  it("skips pairs with no equals sign in map default", () => {
    expect(parseDefault("map", "host1=serviceA,invalidentry,host2=serviceB")).toEqual({
      host1: "serviceA",
      host2: "serviceB",
    });
  });

  it("trims whitespace inside list CSV", () => {
    expect(parseDefault("list", "A, B ,C")).toEqual(["A", "B", "C"]);
  });
});
