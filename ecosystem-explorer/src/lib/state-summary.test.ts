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
import { countConfiguredLeaves } from "./state-summary";

describe("countConfiguredLeaves", () => {
  it("returns 0 for null, undefined, and empty containers", () => {
    expect(countConfiguredLeaves(null)).toBe(0);
    expect(countConfiguredLeaves(undefined)).toBe(0);
    expect(countConfiguredLeaves({})).toBe(0);
    expect(countConfiguredLeaves([])).toBe(0);
  });

  it("counts each non-null primitive as one leaf", () => {
    expect(countConfiguredLeaves("hello")).toBe(1);
    expect(countConfiguredLeaves(42)).toBe(1);
    expect(countConfiguredLeaves(false)).toBe(1);
  });

  it("recurses into nested objects", () => {
    expect(
      countConfiguredLeaves({
        endpoint: "http://example",
        timeout: 30_000,
        tls: { ca_file: "/etc/ca", insecure: false },
      })
    ).toBe(4);
  });

  it("recurses into arrays", () => {
    expect(countConfiguredLeaves([1, 2, 3])).toBe(3);
    expect(countConfiguredLeaves([{ a: 1 }, { b: 2, c: 3 }])).toBe(3);
  });

  it("ignores nulls embedded in containers", () => {
    expect(countConfiguredLeaves({ a: 1, b: null, c: undefined, d: 2 })).toBe(2);
  });
});
