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
import { hasUserValues, hydrateStarterState } from "./state-hydrate";
import type { ConfigStarter } from "@/types/configuration";

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
