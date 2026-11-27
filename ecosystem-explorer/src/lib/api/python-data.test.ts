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
import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import "fake-indexeddb/auto";
import * as pythonData from "./python-data";
import * as idbCache from "./idb-cache";
import type { PythonIndex, PythonPackage } from "@/types/python";

declare const global: typeof globalThis;

const FLASK = "opentelemetry-instrumentation-flask";

const mockIndex: PythonIndex = {
  ecosystem: "python",
  packages: [
    {
      name: FLASK,
      description: "Flask instrumentation for OpenTelemetry",
      supports_metrics: null,
      semantic_convention_status: null,
      version: "0.67b0",
      releases: [
        { version: "0.67b0", hash: "newhash00001" },
        // Two releases sharing one file: only the version was bumped.
        { version: "0.66b2", hash: "oldhash00001" },
        { version: "0.66b1", hash: "oldhash00001" },
      ],
    },
  ],
};

const newFlask: PythonPackage = { name: FLASK, requires_python: ">=3.11" };
const oldFlask: PythonPackage = { name: FLASK, requires_python: ">=3.10", supports_metrics: false };

function respondWith(body: unknown) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

/** Serves the mock index and the two package files by URL. */
function serveFixtures() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
    if (url.endsWith("/index.json")) return respondWith(mockIndex);
    if (url.endsWith(`${FLASK}-newhash00001.json`)) return respondWith(newFlask);
    if (url.endsWith(`${FLASK}-oldhash00001.json`)) return respondWith(oldFlask);
    return { ok: false, status: 404, headers: new Headers() };
  });
}

describe("python-data", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    await idbCache.clearAllCached();
    idbCache.closeDB();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    idbCache.closeDB();
  });

  describe("loadIndex", () => {
    it("loads index.json from the python data directory", async () => {
      serveFixtures();

      await expect(pythonData.loadIndex()).resolves.toEqual(mockIndex);
      expect(global.fetch).toHaveBeenCalledWith("/data/python/index.json");
    });

    it("keeps null flags as null rather than turning them into false", async () => {
      serveFixtures();

      const index = await pythonData.loadIndex();
      expect(index.packages[0].supports_metrics).toBeNull();
      expect(index.packages[0].semantic_convention_status).toBeNull();
    });

    it("rejects a response without a packages list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        respondWith({ ecosystem: "python" })
      );

      await expect(pythonData.loadIndex()).rejects.toThrow();
    });

    it("does not share a cache entry with the javascript index", async () => {
      serveFixtures();
      await pythonData.loadIndex();

      expect(await idbCache.getCached("python-index", idbCache.STORES.METADATA)).not.toBeNull();
      expect(await idbCache.getCached("javascript-index", idbCache.STORES.METADATA)).toBeNull();
    });
  });

  describe("loadPackage", () => {
    it("loads the latest release when no version is given", async () => {
      serveFixtures();

      await expect(pythonData.loadPackage(FLASK)).resolves.toEqual(newFlask);
      expect(global.fetch).toHaveBeenCalledWith(
        `/data/python/packages/${FLASK}/${FLASK}-newhash00001.json`
      );
    });

    it("loads the file a specific release points at", async () => {
      serveFixtures();

      await expect(pythonData.loadPackage(FLASK, "0.66b1")).resolves.toEqual(oldFlask);
    });

    it("fetches a file shared by several releases only once", async () => {
      serveFixtures();

      await pythonData.loadPackage(FLASK, "0.66b2");
      await pythonData.loadPackage(FLASK, "0.66b1");

      const fileFetches = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
        String(url).includes("oldhash00001")
      );
      expect(fileFetches).toHaveLength(1);
    });

    it("uses a pre-loaded index instead of fetching it again", async () => {
      serveFixtures();

      await pythonData.loadPackage(FLASK, undefined, mockIndex);

      const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.endsWith("/index.json"))).toBe(false);
    });

    it("rejects an unknown package, naming Python in the message", async () => {
      serveFixtures();

      await expect(pythonData.loadPackage("opentelemetry-instrumentation-nope")).rejects.toThrow(
        'Python package "opentelemetry-instrumentation-nope" not found'
      );
    });

    it("rejects an unknown release", async () => {
      serveFixtures();

      await expect(pythonData.loadPackage(FLASK, "9.9")).rejects.toThrow("has no release 9.9");
    });

    it("rejects a name that is not a safe path segment, before any fetch", async () => {
      const unsafe: PythonIndex = {
        ecosystem: "python",
        packages: [{ ...mockIndex.packages[0], name: "../escape" }],
      };

      await expect(pythonData.loadPackage("../escape", undefined, unsafe)).rejects.toThrow(
        "Invalid path segment"
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects a package file whose name does not match", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) =>
        url.endsWith("/index.json")
          ? respondWith(mockIndex)
          : respondWith({ name: "opentelemetry-instrumentation-other" })
      );

      await expect(pythonData.loadPackage(FLASK)).rejects.toThrow();
    });
  });
});
