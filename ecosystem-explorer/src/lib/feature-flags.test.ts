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
import { describe, it, expect, vi, afterEach } from "vitest";
import { isEnabled } from "./feature-flags";

describe("isEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return true for 'true'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "true");
    expect(isEnabled("V1_REDESIGN")).toBe(true);
  });

  it("should return true for '1'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "1");
    expect(isEnabled("V1_REDESIGN")).toBe(true);
  });

  it("should return true for 'yes'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "yes");
    expect(isEnabled("V1_REDESIGN")).toBe(true);
  });

  it("should return true for uppercase truthy values", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "TRUE");
    expect(isEnabled("V1_REDESIGN")).toBe(true);
  });

  it("should return false for 'false'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "false");
    expect(isEnabled("V1_REDESIGN")).toBe(false);
  });

  it("should return false for '0'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "0");
    expect(isEnabled("V1_REDESIGN")).toBe(false);
  });

  it("should return false for 'no'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "no");
    expect(isEnabled("V1_REDESIGN")).toBe(false);
  });

  it("should return false for an empty string", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "");
    expect(isEnabled("V1_REDESIGN")).toBe(false);
  });
});
