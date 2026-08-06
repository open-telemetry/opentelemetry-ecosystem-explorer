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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useJavaAgentSummary } from "./use-java-agent-summary";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadVersions: vi.fn(),
  loadAllInstrumentations: vi.fn(),
}));

import * as javaagentData from "@/lib/api/javaagent-data";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useJavaAgentSummary", () => {
  it("should start in loading state", () => {
    vi.mocked(javaagentData.loadVersions).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useJavaAgentSummary());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should load summary data successfully when latest version exists", async () => {
    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [
        { version: "1.2.0", is_latest: false },
        { version: "1.3.0", is_latest: true },
      ],
    });
    vi.mocked(javaagentData.loadAllInstrumentations).mockResolvedValue([
      {
        name: "inst1",
        scope: { name: "scope1" },
        has_spans: true,
        has_metrics: false,
        _is_custom: false,
      },
      {
        name: "inst2",
        scope: { name: "scope2" },
        has_spans: false,
        has_metrics: true,
        _is_custom: true,
      },
    ]);

    const { result } = renderHook(() => useJavaAgentSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.latestVersion).toBe("1.3.0");
    expect(result.current.data?.instrumentationCount).toBe(2);
    expect(result.current.error).toBeNull();
    expect(javaagentData.loadAllInstrumentations).toHaveBeenCalledWith("1.3.0");
  });

  it("should fallback to the first version if none are marked as latest", async () => {
    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [
        { version: "1.2.0", is_latest: false },
        { version: "1.3.0", is_latest: false },
      ],
    });
    vi.mocked(javaagentData.loadAllInstrumentations).mockResolvedValue([]);

    const { result } = renderHook(() => useJavaAgentSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.latestVersion).toBe("1.2.0");
    expect(result.current.data?.instrumentationCount).toBe(0);
    expect(result.current.error).toBeNull();
    expect(javaagentData.loadAllInstrumentations).toHaveBeenCalledWith("1.2.0");
  });

  it("should set error state if loading versions fails", async () => {
    const testError = new Error("Failed to fetch versions");
    vi.mocked(javaagentData.loadVersions).mockRejectedValue(testError);

    const { result } = renderHook(() => useJavaAgentSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(testError);
  });

  it("should set error state if loading instrumentations fails", async () => {
    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [{ version: "1.3.0", is_latest: true }],
    });
    const testError = new Error("Failed to fetch instrumentations");
    vi.mocked(javaagentData.loadAllInstrumentations).mockRejectedValue(testError);

    const { result } = renderHook(() => useJavaAgentSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(testError);
  });
});
