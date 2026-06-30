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
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useReleaseComparison } from "./use-release-comparison";
import * as javaagentData from "@/lib/api/javaagent-data";
import { compareReleases } from "../utils/release-diff";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadAllInstrumentationDetails: vi.fn(),
}));

vi.mock("../utils/release-diff", () => ({
  compareReleases: vi.fn(),
}));

describe("useReleaseComparison hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validVersions = ["2.0.0", "1.5.0", "1.0.0"];

  it("should handle valid ordered version comparisons", async () => {
    vi.mocked(javaagentData.loadAllInstrumentationDetails).mockResolvedValue([]);
    vi.mocked(compareReleases).mockReturnValue({
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      instrumentations: [],
      totals: { added: 0, removed: 0, changed: 0 },
      aggregateMetrics: [],
    });

    const { result } = renderHook(() => useReleaseComparison("1.0.0", "2.0.0", validVersions));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.diff).toBeTruthy();
    expect(javaagentData.loadAllInstrumentationDetails).toHaveBeenCalledTimes(2);
    expect(compareReleases).toHaveBeenCalled();
  });

  it("should not load data if fromVersion and toVersion are the same", async () => {
    const { result } = renderHook(() => useReleaseComparison("1.0.0", "1.0.0", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadAllInstrumentationDetails).not.toHaveBeenCalled();
  });

  it("should not load data for invalid or non-existent versions", async () => {
    const { result } = renderHook(() => useReleaseComparison("1.0.0", "invalid", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadAllInstrumentationDetails).not.toHaveBeenCalled();
  });

  it("should not load data if versions are out of order (from > to)", async () => {
    const { result } = renderHook(() => useReleaseComparison("2.0.0", "1.0.0", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadAllInstrumentationDetails).not.toHaveBeenCalled();
  });
});
