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
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "true");
    expect(isEnabled("MY_FLAG")).toBe(true);
  });

  it("should return true for '1'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "1");
    expect(isEnabled("MY_FLAG")).toBe(true);
  });

  it("should return true for 'yes'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "yes");
    expect(isEnabled("MY_FLAG")).toBe(true);
  });

  it("should return true for uppercase truthy values", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "TRUE");
    expect(isEnabled("MY_FLAG")).toBe(true);
  });

  it("should return false for 'false'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "false");
    expect(isEnabled("MY_FLAG")).toBe(false);
  });

  it("should return false for '0'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "0");
    expect(isEnabled("MY_FLAG")).toBe(false);
  });

  it("should return false for 'no'", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "no");
    expect(isEnabled("MY_FLAG")).toBe(false);
  });

  it("should return false for an empty string", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_MY_FLAG", "");
    expect(isEnabled("MY_FLAG")).toBe(false);
  });

  it("should return false for a missing flag", () => {
    expect(isEnabled("MY_MISSING_FLAG")).toBe(false);
  });
});
