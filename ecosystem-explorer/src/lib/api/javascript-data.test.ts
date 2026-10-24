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
import * as javascriptData from "./javascript-data";
import * as idbCache from "./idb-cache";
import type { JavascriptIndex, JavascriptPackage } from "@/types/javascript";

declare const global: typeof globalThis;

const mockIndex: JavascriptIndex = {
  ecosystem: "javascript",
  packages: [
    {
      name: "instrumentation-express",
      npm_package: "@opentelemetry/instrumentation-express",
      description: "Express instrumentation",
      in_auto_instrumentations_node: true,
      version: "0.70.0",
      releases: [
        { version: "0.70.0", hash: "newhash00001" },
        // Two releases sharing one file: only the version was bumped.
        { version: "0.69.0", hash: "oldhash00001" },
        { version: "0.68.0", hash: "oldhash00001" },
      ],
    },
  ],
};

const newExpress: JavascriptPackage = {
  name: "instrumentation-express",
  npm_package: "@opentelemetry/instrumentation-express",
  node_engine: ">=20",
};

const oldExpress: JavascriptPackage = {
  name: "instrumentation-express",
  npm_package: "@opentelemetry/instrumentation-express",
  node_engine: ">=18",
};

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
    if (url.endsWith("instrumentation-express-newhash00001.json")) return respondWith(newExpress);
    if (url.endsWith("instrumentation-express-oldhash00001.json")) return respondWith(oldExpress);
    return { ok: false, status: 404, headers: new Headers() };
  });
}

describe("javascript-data", () => {
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
    it("loads index.json from the javascript data directory", async () => {
      serveFixtures();

      await expect(javascriptData.loadIndex()).resolves.toEqual(mockIndex);
      expect(global.fetch).toHaveBeenCalledWith("/data/javascript/index.json");
    });

    it("rejects a response without a packages list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        respondWith({ ecosystem: "javascript" })
      );

      await expect(javascriptData.loadIndex()).rejects.toThrow();
    });
  });

  describe("loadPackage", () => {
    it("loads the latest release when no version is given", async () => {
      serveFixtures();

      await expect(javascriptData.loadPackage("instrumentation-express")).resolves.toEqual(
        newExpress
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/data/javascript/packages/instrumentation-express/instrumentation-express-newhash00001.json"
      );
    });

    it("loads the file a specific release points at", async () => {
      serveFixtures();

      await expect(
        javascriptData.loadPackage("instrumentation-express", "0.68.0")
      ).resolves.toEqual(oldExpress);
    });

    it("fetches a file shared by two releases only once", async () => {
      serveFixtures();

      await javascriptData.loadPackage("instrumentation-express", "0.69.0");
      await javascriptData.loadPackage("instrumentation-express", "0.68.0");

      const fileFetches = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
        String(url).endsWith("oldhash00001.json")
      );
      expect(fileFetches).toHaveLength(1);
    });

    it("uses a pre-loaded index instead of fetching it again", async () => {
      serveFixtures();

      await javascriptData.loadPackage("instrumentation-express", undefined, mockIndex);

      expect(global.fetch).not.toHaveBeenCalledWith("/data/javascript/index.json");
    });

    it("throws for a package that is not in the index", async () => {
      serveFixtures();

      await expect(javascriptData.loadPackage("instrumentation-nope")).rejects.toThrow(
        'JavaScript package "instrumentation-nope" not found'
      );
    });

    it("throws for a version the package never released", async () => {
      serveFixtures();

      await expect(javascriptData.loadPackage("instrumentation-express", "9.9.9")).rejects.toThrow(
        "has no release 9.9.9"
      );
    });

    it("refuses a name that would escape the data directory", async () => {
      const index: JavascriptIndex = {
        ecosystem: "javascript",
        packages: [{ ...mockIndex.packages[0], name: "../secrets" }],
      };

      await expect(javascriptData.loadPackage("../secrets", undefined, index)).rejects.toThrow(
        "Invalid path segment"
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects a package file whose name does not match the request", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        respondWith({ ...newExpress, name: "instrumentation-koa" })
      );

      await expect(
        javascriptData.loadPackage("instrumentation-express", undefined, mockIndex)
      ).rejects.toThrow();
    });

    it("serves a cached package file without fetching, even a day later", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      await idbCache.setCached(
        "javascript-package-instrumentation-express-newhash00001",
        newExpress,
        idbCache.STORES.INSTRUMENTATIONS
      );
      vi.advanceTimersByTime(48 * 60 * 60 * 1000);
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));

      await expect(
        javascriptData.loadPackage("instrumentation-express", undefined, mockIndex)
      ).resolves.toEqual(newExpress);
      expect(global.fetch).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
