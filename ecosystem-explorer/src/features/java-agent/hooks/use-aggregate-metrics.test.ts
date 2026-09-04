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
import { useAggregateMetrics } from "./use-aggregate-metrics";
import * as javaagentData from "@/lib/api/javaagent-data";
import type { InstrumentationData } from "@/types/javaagent";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadAllInstrumentationDetails: vi.fn(),
}));

describe("useAggregateMetrics hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const releaseData: InstrumentationData[] = [
    {
      name: "instr1",
      display_name: "Instr One",
      scope: { name: "test" },
      telemetry: [
        {
          when: "default",
          metrics: [
            {
              name: "metric.a",
              description: "d",
              instrument: "counter",
              data_type: "COUNTER",
              unit: "1",
            },
          ],
        },
      ],
    },
  ];

  it("should not load while disabled", () => {
    const { result } = renderHook(() => useAggregateMetrics("2.10.0", false));

    expect(result.current.loading).toBe(false);
    expect(result.current.metrics).toBeNull();
    expect(javaagentData.loadAllInstrumentationDetails).not.toHaveBeenCalled();
  });

  it("should load and roll up metrics once enabled", async () => {
    vi.mocked(javaagentData.loadAllInstrumentationDetails).mockResolvedValue(releaseData);

    const { result, rerender } = renderHook(
      ({ enabled }) => useAggregateMetrics("2.10.0", enabled),
      { initialProps: { enabled: false } }
    );

    expect(javaagentData.loadAllInstrumentationDetails).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(javaagentData.loadAllInstrumentationDetails).toHaveBeenCalledWith("2.10.0");
    expect(result.current.metrics).toEqual([
      { name: "metric.a", description: "d", emittedBy: ["Instr One"] },
    ]);
  });

  it("should surface load errors", async () => {
    vi.mocked(javaagentData.loadAllInstrumentationDetails).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useAggregateMetrics("2.10.0", true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.message).toBe("boom");
    expect(result.current.metrics).toBeNull();
  });

  it("should clear loading when disabled while a request is still in flight", async () => {
    let resolveLoad!: (data: InstrumentationData[]) => void;
    vi.mocked(javaagentData.loadAllInstrumentationDetails).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    const { result, rerender } = renderHook(
      ({ enabled }) => useAggregateMetrics("2.10.0", enabled),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => expect(result.current.loading).toBe(true));

    // Closing the tab before the request resolves must not leave the hook
    // reporting loading forever.
    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);

    // The stale request resolving afterward must not resurrect loading or
    // apply its result.
    resolveLoad(releaseData);
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.loading).toBe(false);
    expect(result.current.metrics).toBeNull();
  });

  it("should not show the previous version's metrics after the version changes", async () => {
    vi.mocked(javaagentData.loadAllInstrumentationDetails).mockResolvedValue(releaseData);

    const { result, rerender } = renderHook(({ version }) => useAggregateMetrics(version, true), {
      initialProps: { version: "2.10.0" },
    });

    await waitFor(() => expect(result.current.metrics).not.toBeNull());
    expect(result.current.metrics).toEqual([
      { name: "metric.a", description: "d", emittedBy: ["Instr One"] },
    ]);

    // The effect that reloads for "2.11.0" runs after this render commits, so
    // without version-tagged state this render would still show 2.10.0's
    // metrics. It must report null instead of stale data for the old version.
    rerender({ version: "2.11.0" });
    expect(result.current.metrics).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(javaagentData.loadAllInstrumentationDetails).toHaveBeenCalledWith("2.11.0");
  });
});
