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
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { fetchWithCache } from "./fetch-with-cache";
import * as idbCache from "./idb-cache";

declare const global: typeof globalThis;

describe("fetchWithCache", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    idbCache.closeDB();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    idbCache.closeDB();
  });

  it("should fetch and cache on cache miss", async () => {
    const data = { test: "value" };
    const getCachedSpy = vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
    const setCachedSpy = vi.spyOn(idbCache, "setCached").mockResolvedValue();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => data,
    });

    const result = await fetchWithCache<typeof data>("key", "/url", idbCache.STORES.METADATA);

    expect(result).toEqual(data);
    expect(getCachedSpy).toHaveBeenCalledWith("key", idbCache.STORES.METADATA);
    expect(global.fetch).toHaveBeenCalledWith("/url");
    expect(setCachedSpy).toHaveBeenCalledWith("key", data, idbCache.STORES.METADATA);
  });

  it("should return cached data on cache hit without fetching", async () => {
    const data = { test: "cached" };
    vi.spyOn(idbCache, "getCached").mockResolvedValue(data);
    vi.spyOn(idbCache, "setCached");

    const result = await fetchWithCache<typeof data>("key", "/url", idbCache.STORES.METADATA);

    expect(result).toEqual(data);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should propagate fetch errors", async () => {
    vi.spyOn(idbCache, "getCached").mockResolvedValue(null);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(fetchWithCache("key", "/url", idbCache.STORES.METADATA)).rejects.toThrow(
      "Failed to load key: 404 Not Found"
    );
  });

  it("should deduplicate concurrent requests", async () => {
    vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
    vi.spyOn(idbCache, "setCached").mockResolvedValue();

    const data = { test: "dedup" };
    let fetchResolve: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      fetchResolve = resolve;
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(fetchPromise);

    const r1 = fetchWithCache("same-key", "/url", idbCache.STORES.METADATA);
    const r2 = fetchWithCache("same-key", "/url", idbCache.STORES.METADATA);

    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    fetchResolve!({ ok: true, json: async () => data });

    const [result1, result2] = await Promise.all([r1, r2]);
    expect(result1).toEqual(data);
    expect(result2).toEqual(data);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should work without IDB available", async () => {
    const data = { test: "no-idb" };
    vi.spyOn(idbCache, "isIDBAvailable").mockReturnValue(false);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => data,
    });

    const result = await fetchWithCache<typeof data>("key", "/url", idbCache.STORES.METADATA);

    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith("/url");
  });
});
