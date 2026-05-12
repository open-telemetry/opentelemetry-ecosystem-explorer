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
import { hasMeaningfulLeaf, hasUserValues, hydrateStarterState } from "./state-hydrate";
import type { ConfigStarter } from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";

describe("hasUserValues", () => {
  it("returns false for undefined and null", () => {
    expect(hasUserValues(undefined)).toBe(false);
    expect(hasUserValues(null)).toBe(false);
  });
  it("returns true for strings, numbers, booleans, objects, arrays", () => {
    expect(hasUserValues("")).toBe(true);
    expect(hasUserValues("x")).toBe(true);
    expect(hasUserValues(0)).toBe(true);
    expect(hasUserValues(false)).toBe(true);
    expect(hasUserValues({})).toBe(true);
    expect(hasUserValues([])).toBe(true);
  });
});

describe("hasMeaningfulLeaf", () => {
  it("returns false for undefined, null, and empty string", () => {
    expect(hasMeaningfulLeaf(undefined)).toBe(false);
    expect(hasMeaningfulLeaf(null)).toBe(false);
    expect(hasMeaningfulLeaf("")).toBe(false);
  });
  it("returns true for primitives that carry content", () => {
    expect(hasMeaningfulLeaf("x")).toBe(true);
    expect(hasMeaningfulLeaf(0)).toBe(true);
    expect(hasMeaningfulLeaf(false)).toBe(true);
  });
  it("returns false for empty containers and containers of only-empty leaves", () => {
    expect(hasMeaningfulLeaf({})).toBe(false);
    expect(hasMeaningfulLeaf([])).toBe(false);
    // Cast through `unknown` because ConfigValue's record type forbids
    // `undefined` entries, but we want to assert the predicate's runtime
    // behavior against the stale shape that JSON-parsed state can carry.
    expect(hasMeaningfulLeaf({ a: undefined, b: null, c: "" } as unknown as ConfigValue)).toBe(
      false
    );
    expect(
      hasMeaningfulLeaf({ java: { "cassandra-4.4": undefined } } as unknown as ConfigValue)
    ).toBe(false);
    expect(hasMeaningfulLeaf({ java: {} })).toBe(false);
  });
  it("returns true when any leaf is meaningful", () => {
    expect(hasMeaningfulLeaf({ general: { service_name: "x" } })).toBe(true);
    expect(hasMeaningfulLeaf({ java: { "cassandra-4.4": { enabled: false } } })).toBe(true);
    expect(hasMeaningfulLeaf([null, "", { a: "x" }])).toBe(true);
  });
});

describe("hydrateStarterState", () => {
  it("returns empty state when starter is null", () => {
    const s = hydrateStarterState("1.0.0", null);
    expect(s).toEqual({
      version: "1.0.0",
      values: {},
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
      listItemIds: {},
    });
  });
  it("copies starter values and enabledSections into the state", () => {
    const starter: ConfigStarter = {
      enabledSections: { resource: true },
      values: { resource: { attributes: [{ name: "service.name" }] } },
    };
    const s = hydrateStarterState("1.0.0", starter);
    expect(s.version).toBe("1.0.0");
    expect(s.enabledSections).toEqual({ resource: true });
    expect(s.values).toEqual({ resource: { attributes: [{ name: "service.name" }] } });
    expect(s.isDirty).toBe(false);
    expect(s.validationErrors).toEqual({});
    expect(s.listItemIds!["resource.attributes"]).toHaveLength(1);
  });
});
