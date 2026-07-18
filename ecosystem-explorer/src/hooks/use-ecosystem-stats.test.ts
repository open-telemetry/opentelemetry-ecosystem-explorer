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
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEcosystemStats } from "./use-ecosystem-stats";

const SAMPLE_JAVA_AGENT_STATS = { version_count: 5, library_count: 263 };
const SAMPLE_COLLECTOR_STATS = { version_count: 7, component_count: 271 };

function stubFetch(byUrl: Record<string, { ok: boolean; status?: number; body?: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const response = byUrl[url];
      if (!response) throw new Error(`Unexpected fetch to ${url}`);
      return Promise.resolve({
        ok: response.ok,
        status: response.status ?? 200,
        json: async () => response.body,
      });
    })
  );
}

describe("useEcosystemStats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts in loading state and transitions to populated", async () => {
    stubFetch({
      "/java.json": { ok: true, body: SAMPLE_JAVA_AGENT_STATS },
      "/collector.json": { ok: true, body: SAMPLE_COLLECTOR_STATS },
    });

    const { result } = renderHook(() =>
      useEcosystemStats({ javaAgentStatsUrl: "/java.json", collectorStatsUrl: "/collector.json" })
    );

    expect(result.current).toEqual({ data: null, loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({
      javaAgent: SAMPLE_JAVA_AGENT_STATS,
      collector: SAMPLE_COLLECTOR_STATS,
    });
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state when either fetch is unreachable", async () => {
    stubFetch({
      "/java.json": { ok: true, body: SAMPLE_JAVA_AGENT_STATS },
      "/collector.json": { ok: false, status: 500 },
    });

    const { result } = renderHook(() =>
      useEcosystemStats({ javaAgentStatsUrl: "/java.json", collectorStatsUrl: "/collector.json" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });

  it("clears a prior error when the urls change and the new fetches succeed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_JAVA_AGENT_STATS })
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_COLLECTOR_STATS });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({
        javaAgentStatsUrl,
        collectorStatsUrl,
      }: {
        javaAgentStatsUrl: string;
        collectorStatsUrl: string;
      }) => useEcosystemStats({ javaAgentStatsUrl, collectorStatsUrl }),
      {
        initialProps: {
          javaAgentStatsUrl: "/broken-java.json",
          collectorStatsUrl: "/broken-collector.json",
        },
      }
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    rerender({ javaAgentStatsUrl: "/java.json", collectorStatsUrl: "/collector.json" });

    await waitFor(() =>
      expect(result.current.data).toEqual({
        javaAgent: SAMPLE_JAVA_AGENT_STATS,
        collector: SAMPLE_COLLECTOR_STATS,
      })
    );
    expect(result.current.error).toBeNull();
  });
});
