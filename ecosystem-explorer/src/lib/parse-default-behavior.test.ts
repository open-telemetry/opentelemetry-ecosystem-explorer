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
import { parseBooleanDefault } from "./parse-default-behavior";

describe("parseBooleanDefault", () => {
  it("returns true for the canonical 'true is used' pattern", () => {
    expect(parseBooleanDefault("true is used")).toBe(true);
  });

  it("returns true for slight variations starting with 'true is'", () => {
    expect(parseBooleanDefault("true is the default")).toBe(true);
    expect(parseBooleanDefault("True is used.")).toBe(true);
  });

  it("returns false for the canonical 'false is used' pattern", () => {
    expect(parseBooleanDefault("false is used")).toBe(false);
    expect(parseBooleanDefault("FALSE is used")).toBe(false);
  });

  it("returns null for unparseable text", () => {
    expect(parseBooleanDefault("trace based filtering is not applied")).toBe(null);
    expect(parseBooleanDefault("the default behaviour is unspecified")).toBe(null);
  });

  it("returns null for empty / undefined", () => {
    expect(parseBooleanDefault("")).toBe(null);
    expect(parseBooleanDefault(undefined)).toBe(null);
  });

  it("trims leading whitespace before matching", () => {
    expect(parseBooleanDefault("   true is used")).toBe(true);
  });
});
