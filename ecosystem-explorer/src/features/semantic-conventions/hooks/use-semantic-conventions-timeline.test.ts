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
import { useSemanticConventionsTimeline } from "./use-semantic-conventions-timeline";
import type { TimelineData } from "../types";

const SAMPLE_DATA: TimelineData = {
  lanes: [{ id: "http", title: "HTTP", subtitle: "Core conventions" }],
  events: [
    {
      id: "http-stable",
      lane: "http",
      release: "1.23.0",
      type: "stability",
      short: "Core stable",
      title: "Core HTTP semantic conventions stabilize",
      detail: "Detail text.",
      source: "https://example.com/source",
      major: true,
      date: "2023-11-03",
    },
  ],
  dates: { "1.23.0": "2023-11-03" },
};

describe("useSemanticConventionsTimeline", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("starts in loading state", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useSemanticConventionsTimeline());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("loads timeline data successfully", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(SAMPLE_DATA), { status: 200 }));

    const { result } = renderHook(() => useSemanticConventionsTimeline());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(SAMPLE_DATA);
    expect(result.current.error).toBeNull();
  });

  it("sets an error state when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );

    const { result } = renderHook(() => useSemanticConventionsTimeline());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("sets an error state when the fetch rejects", async () => {
    const testError = new Error("network down");
    vi.mocked(fetch).mockRejectedValue(testError);

    const { result } = renderHook(() => useSemanticConventionsTimeline());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(testError);
  });
});
