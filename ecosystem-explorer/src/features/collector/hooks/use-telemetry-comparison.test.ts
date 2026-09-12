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
import type { CollectorComponent } from "@/types/collector";

vi.mock("@/lib/api/collector-data", () => ({
  loadComponent: vi.fn(),
}));

const DISTRIBUTION = "core";
const NAME = "memorylimiterprocessor";

function makeComponent(metricName: string): CollectorComponent {
  return {
    id: `${DISTRIBUTION}-${NAME}`,
    name: NAME,
    ecosystem: "collector",
    type: "processor",
    distribution: DISTRIBUTION,
    telemetry: {
      metrics: {
        [metricName]: { description: "d", enabled: true, unit: "1" },
      },
    },
  };
}

describe("useTelemetryComparison hook (collector)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads both versions and computes a diff", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_dist, _name, version) =>
      makeComponent(version === "1.0.0" ? "old.metric" : "new.metric")
    );

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", "2.0.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.diffResult?.metrics).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(result.current.fromNotFound).toBe(false);
    expect(result.current.toNotFound).toBe(false);
  });

  it("marks fromNotFound and still computes a partial diff when only the 'from' version fails to load", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_dist, _name, version) => {
      if (version === "1.0.0") throw new Error("not found");
      return makeComponent("new.metric");
    });

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", "2.0.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.fromNotFound).toBe(true);
    expect(result.current.toNotFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.diffResult?.metrics).toEqual([
      { status: "added", name: "new.metric", metric: expect.any(Object) },
    ]);
  });

  it("marks toNotFound and still computes a partial diff when only the 'to' version fails to load", async () => {
    vi.mocked(collectorData.loadComponent).mockImplementation(async (_dist, _name, version) => {
      if (version === "2.0.0") throw new Error("not found");
      return makeComponent("old.metric");
    });

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", "2.0.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.toNotFound).toBe(true);
    expect(result.current.fromNotFound).toBe(false);
    expect(result.current.diffResult?.metrics).toEqual([
      { status: "removed", name: "old.metric", metric: expect.any(Object) },
    ]);
  });

  it("sets an error and no diff when both versions fail to load", async () => {
    vi.mocked(collectorData.loadComponent).mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", "2.0.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.fromNotFound).toBe(true);
    expect(result.current.toNotFound).toBe(true);
    expect(result.current.diffResult).toBeNull();
  });

  it("does not fetch and returns a null diff when fromVersion equals toVersion", async () => {
    const { result } = renderHook(() =>
      useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", "1.0.0")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(collectorData.loadComponent).not.toHaveBeenCalled();
    expect(result.current.diffResult).toBeNull();
  });

  it("does not apply a stale result when toVersion changes while a fetch is still in flight", async () => {
    let resolveSlowFetch: (value: CollectorComponent) => void;

    vi.mocked(collectorData.loadComponent).mockImplementation(async (_dist, _name, version) => {
      if (version === "1.0.0") {
        return new Promise<CollectorComponent>((resolve) => {
          resolveSlowFetch = resolve;
        });
      }
      return makeComponent(`metric-${version}`);
    });

    const { result, rerender } = renderHook(
      ({ toVersion }) => useTelemetryComparison(DISTRIBUTION, NAME, "1.0.0", toVersion),
      { initialProps: { toVersion: "2.0.0" } }
    );

    // Switch toVersion before the slow "from" fetch (shared across renders) resolves.
    rerender({ toVersion: "3.0.0" });

    await waitFor(() => expect(result.current.loading).toBe(true));

    resolveSlowFetch!(makeComponent("old.metric"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The effect belonging to the stale ("2.0.0") render was cancelled; only the
    // latest ("3.0.0") comparison's result should be applied.
    expect(result.current.toVersion).toBe("3.0.0");
    expect(result.current.diffResult?.metrics.some((m) => m.name === "metric-3.0.0")).toBe(true);
  });
});
