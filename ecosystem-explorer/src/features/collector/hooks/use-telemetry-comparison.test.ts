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
import { useTelemetryComparison } from "./use-telemetry-comparison";
import * as collectorData from "@/lib/api/collector-data";
import { compareTelemetryMetrics } from "../utils/telemetry-diff";
import type { CollectorComponent, CollectorTelemetryDiffResult } from "@/types/collector";

vi.mock("@/lib/api/collector-data", () => ({
  loadComponent: vi.fn(),
}));

vi.mock("../utils/telemetry-diff", () => ({
  compareTelemetryMetrics: vi.fn(),
}));

const DISTRIBUTION = "core";
const NAME = "memorylimiterprocessor";

function stubComponent(version: string): CollectorComponent {
  return {
    id: `${DISTRIBUTION}-${NAME}`,
    name: NAME,
    ecosystem: "collector",
    type: "processor",
    distribution: DISTRIBUTION,
    description: version,
  };
}

describe("useTelemetryComparison hook (collector)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compareTelemetryMetrics).mockImplementation(
      (from, to): CollectorTelemetryDiffResult => ({
        metrics: [
          {
            status: "changed",
            name: "combined",
            metric: { description: "d", enabled: true, unit: "1" },
            changes: {
              description: {
                before: (from as CollectorComponent | null)?.description ?? "",
                after: (to as CollectorComponent | null)?.description ?? "",
              },
            },
          },
        ],
      })
    );
  });

  it("loads both versions and computes a diff", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_d, _n, version) =>
      stubComponent(version)
    );

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.101.0")
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.diffResult?.metrics[0].changes?.description).toEqual({
      before: "0.100.0",
      after: "0.101.0",
    });
    expect(result.current.fromNotFound).toBe(false);
    expect(result.current.toNotFound).toBe(false);
  });

  it("does not load data when fromVersion and toVersion are the same", () => {
    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.100.0")
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(collectorData.loadComponent).not.toHaveBeenCalled();
  });

  it("marks fromNotFound when only the base version fails to load, but still computes a diff", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_d, _n, version) => {
      if (version === "0.100.0") throw new Error("not found");
      return stubComponent(version);
    });

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.101.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.fromNotFound).toBe(true);
    expect(result.current.toNotFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.diffResult).not.toBeNull();
  });

  it("marks toNotFound when only the target version fails to load, but still computes a diff", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_d, _n, version) => {
      if (version === "0.101.0") throw new Error("not found");
      return stubComponent(version);
    });

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.101.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.toNotFound).toBe(true);
    expect(result.current.fromNotFound).toBe(false);
    expect(result.current.diffResult).not.toBeNull();
  });

  it("surfaces an error and does not compute a diff when both versions fail to load", async () => {
    vi.mocked(collectorData.loadComponent).mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.101.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.fromNotFound).toBe(true);
    expect(result.current.toNotFound).toBe(true);
    expect(result.current.diffResult).toBeNull();
    expect(compareTelemetryMetrics).not.toHaveBeenCalled();
  });

  it("does not let a stale in-flight request overwrite a newer one's result", async () => {
    let resolveFirst!: (value: CollectorComponent) => void;
    let resolveSecond!: (value: CollectorComponent) => void;
    const firstToCall = new Promise<CollectorComponent>((resolve) => {
      resolveFirst = resolve;
    });
    const secondToCall = new Promise<CollectorComponent>((resolve) => {
      resolveSecond = resolve;
    });

    vi.mocked(collectorData.loadComponent).mockImplementation(async (_d, _n, version) => {
      if (version === "0.100.0") return stubComponent(version);
      if (version === "0.101.0") return firstToCall;
      if (version === "0.102.0") return secondToCall;
      throw new Error(`unexpected version ${version}`);
    });

    const { result, rerender } = renderHook(
      ({ to }: { to: string }) => useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", to),
      { initialProps: { to: "0.101.0" } }
    );

    // Change the target version before the first request resolves - the
    // "cancelled" guard exists for exactly this case.
    rerender({ to: "0.102.0" });

    // Resolve the newer (second) request first, then the stale first one, to
    // prove ordering of resolution - not call order - can't cause a bug.
    resolveSecond(stubComponent("0.102.0"));
    await waitFor(() => expect(result.current.toVersion).toBe("0.102.0"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    resolveFirst(stubComponent("0.101.0"));
    // Give the stale promise's .then chain a chance to run if it were going to.
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.diffResult?.metrics[0].changes?.description?.after).toBe("0.102.0");
    expect(result.current.loading).toBe(false);
  });

  it("recomputes the diff when the caller changes the from/to versions via the returned setters", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_d, _n, version) =>
      stubComponent(version)
    );

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "0.100.0", "0.101.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.toVersion).toBe("0.101.0");

    result.current.setToVersion("0.102.0");

    await waitFor(() => expect(result.current.toVersion).toBe("0.102.0"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.diffResult?.metrics[0].changes?.description?.after).toBe("0.102.0");
  });
});
