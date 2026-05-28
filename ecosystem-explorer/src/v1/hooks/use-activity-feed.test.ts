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
import { useActivityFeed } from "./use-activity-feed";

const SAMPLE_FEED = {
  generatedAt: "2026-05-13T00:00:00Z",
  items: [
    {
      id: "kafka",
      title: "Kafka Receiver promoted to beta",
      stability: "beta",
      ecosystem: "collector",
      version: "v0.150.0",
      occurredAt: "2026-05-11T00:00:00Z",
      href: "/collector/components",
    },
  ],
};

describe("useActivityFeed", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts in loading state and transitions to populated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE_FEED }));

    const { result } = renderHook(() => useActivityFeed({ feedUrl: "/feed.json" }));

    expect(result.current).toEqual({ data: null, loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state when the feed is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );

    const { result } = renderHook(() => useActivityFeed({ feedUrl: "/feed.json" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });

  it("clears a prior error when feedUrl changes and the new fetch succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_FEED });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ feedUrl }: { feedUrl: string }) => useActivityFeed({ feedUrl }),
      { initialProps: { feedUrl: "/broken.json" } }
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    rerender({ feedUrl: "/working.json" });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("honors the limit by slicing the feed", async () => {
    const feed = {
      generatedAt: "2026-05-13T00:00:00Z",
      items: Array.from({ length: 10 }, (_, i) => ({ ...SAMPLE_FEED.items[0], id: `item-${i}` })),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => feed }));

    const { result } = renderHook(() => useActivityFeed({ feedUrl: "/feed.json", limit: 3 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(3);
  });
});
