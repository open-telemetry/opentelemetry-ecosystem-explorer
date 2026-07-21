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
  loadComparisonDetails: vi.fn(),
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
    vi.mocked(javaagentData.loadComparisonDetails).mockResolvedValue({
      fromData: [],
      toData: [],
      unchangedIds: [],
    });
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
    // One call for the pair, not one per version: the loader diffs the two
    // manifests itself so it can skip modules that cannot have changed.
    expect(javaagentData.loadComparisonDetails).toHaveBeenCalledTimes(1);
    expect(javaagentData.loadComparisonDetails).toHaveBeenCalledWith("1.0.0", "2.0.0");
    expect(compareReleases).toHaveBeenCalled();
  });

  it("should skip the release-wide metric rollup", async () => {
    vi.mocked(javaagentData.loadComparisonDetails).mockResolvedValue({
      fromData: [],
      toData: [],
      unchangedIds: [],
    });
    vi.mocked(compareReleases).mockReturnValue({
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      instrumentations: [],
      totals: { added: 0, removed: 0, changed: 0 },
      aggregateMetrics: [],
    });

    const { result } = renderHook(() => useReleaseComparison("1.0.0", "2.0.0", validVersions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The comparison only loads changed modules, which is too little data to
    // roll up release-wide metrics — that tab loads its own data on demand.
    expect(compareReleases).toHaveBeenCalledWith("1.0.0", "2.0.0", [], [], {
      includeAggregateMetrics: false,
    });
  });

  it("should stay loading until the version list arrives", async () => {
    const { result, rerender } = renderHook(
      ({ versions }) => useReleaseComparison("1.0.0", "2.0.0", versions),
      { initialProps: { versions: [] as string[] } }
    );

    // Comparing before the version list lands would start a full load that the
    // next render throws away, doubling the work on every page open.
    expect(result.current.loading).toBe(true);
    expect(javaagentData.loadComparisonDetails).not.toHaveBeenCalled();

    vi.mocked(javaagentData.loadComparisonDetails).mockResolvedValue({
      fromData: [],
      toData: [],
      unchangedIds: [],
    });
    vi.mocked(compareReleases).mockReturnValue({
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      instrumentations: [],
      totals: { added: 0, removed: 0, changed: 0 },
      aggregateMetrics: [],
    });

    rerender({ versions: validVersions });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(javaagentData.loadComparisonDetails).toHaveBeenCalledTimes(1);
  });

  it("should not let a stale in-flight request overwrite a newer one's result", async () => {
    // Two deferred promises so the test controls resolution order directly,
    // rather than relying on timing.
    let resolveFirst!: (value: {
      fromData: unknown[];
      toData: unknown[];
      unchangedIds: string[];
    }) => void;
    let resolveSecond!: (value: {
      fromData: unknown[];
      toData: unknown[];
      unchangedIds: string[];
    }) => void;
    const firstCall = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondCall = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    vi.mocked(javaagentData.loadComparisonDetails)
      .mockImplementationOnce(
        () => firstCall as ReturnType<typeof javaagentData.loadComparisonDetails>
      )
      .mockImplementationOnce(
        () => secondCall as ReturnType<typeof javaagentData.loadComparisonDetails>
      );

    vi.mocked(compareReleases).mockImplementation((fromVersion, toVersion) => ({
      fromVersion,
      toVersion,
      instrumentations: [],
      totals: { added: 0, removed: 0, changed: 0 },
      aggregateMetrics: [],
    }));

    const { result, rerender } = renderHook(
      ({ from, to }) => useReleaseComparison(from, to, validVersions),
      { initialProps: { from: "1.0.0", to: "2.0.0" } }
    );

    expect(javaagentData.loadComparisonDetails).toHaveBeenCalledTimes(1);

    // Change the target version before the first request resolves - this is
    // the scenario the "cancelled" flag exists for. The effect's cleanup
    // marks the first run stale and a second request starts.
    rerender({ from: "1.5.0", to: "2.0.0" });
    expect(javaagentData.loadComparisonDetails).toHaveBeenCalledTimes(2);

    // Resolve the SECOND (current) request first, then the stale first one,
    // to prove ordering of resolution - not call order - is what could cause
    // a bug, and that the guard prevents it either way.
    resolveSecond({ fromData: [], toData: [], unchangedIds: [] });
    await waitFor(() => expect(result.current.diff?.fromVersion).toBe("1.5.0"));

    resolveFirst({ fromData: [], toData: [], unchangedIds: [] });
    // Give the stale promise's .then chain a chance to run if it were going
    // to (it shouldn't, because `cancelled` was set true for that effect run).
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.diff?.fromVersion).toBe("1.5.0");
    expect(result.current.loading).toBe(false);
  });

  it("should not load data if fromVersion and toVersion are the same", async () => {
    const { result } = renderHook(() => useReleaseComparison("1.0.0", "1.0.0", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadComparisonDetails).not.toHaveBeenCalled();
  });

  it("should not load data for invalid or non-existent versions", async () => {
    const { result } = renderHook(() => useReleaseComparison("1.0.0", "invalid", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadComparisonDetails).not.toHaveBeenCalled();
  });

  it("should not load data if versions are out of order (from > to)", async () => {
    const { result } = renderHook(() => useReleaseComparison("2.0.0", "1.0.0", validVersions));

    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
    expect(javaagentData.loadComparisonDetails).not.toHaveBeenCalled();
  });
});
