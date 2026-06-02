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
import * as collectorData from "./collector-data";
import * as idbCache from "./idb-cache";
import type { VersionManifest, CollectorComponent } from "@/types/collector";

declare const global: typeof globalThis;

describe("collector-data", () => {
  // Keys are intentionally ordered receiver-then-exporter so the order-
  // preservation assertion below is meaningful: loadAllComponents must return
  // results in manifest order regardless of fetch completion order.
  const mockVersionManifest: VersionManifest = {
    version: "0.150.0",
    components: {
      "core-otlpreceiver": "hash1",
      "contrib-otlphttpexporter": "hash2",
    },
  };

  const otlpReceiver: CollectorComponent = {
    id: "core-otlpreceiver",
    name: "otlpreceiver",
    ecosystem: "collector",
    type: "receiver",
    distribution: "core",
  };

  const otlpHttpExporter: CollectorComponent = {
    id: "contrib-otlphttpexporter",
    name: "otlphttpexporter",
    ecosystem: "collector",
    type: "exporter",
    distribution: "contrib",
  };

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

  describe("loadAllComponents", () => {
    it("loads all components from the manifest in manifest order", async () => {
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "collector-manifest-0.150.0") return mockVersionManifest;
        if (key === "collector-component-hash1") return otlpReceiver;
        if (key === "collector-component-hash2") return otlpHttpExporter;
        return null;
      });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toHaveLength(2);
      // Order matches the manifest's component-id order, not fetch completion.
      expect(result.map((c) => c.id)).toEqual(["core-otlpreceiver", "contrib-otlphttpexporter"]);
      expect(result[0]).toEqual(otlpReceiver);
      expect(result[1]).toEqual(otlpHttpExporter);
    });

    it("loads the manifest only once for all components", async () => {
      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "collector-manifest-0.150.0") return mockVersionManifest;
          if (key === "collector-component-hash1") return otlpReceiver;
          if (key === "collector-component-hash2") return otlpHttpExporter;
          return null;
        });

      await collectorData.loadAllComponents("0.150.0");

      const manifestCalls = getCachedSpy.mock.calls.filter(
        (call) => call[0] === "collector-manifest-0.150.0"
      );
      expect(manifestCalls).toHaveLength(1);
    });

    it("returns an empty array for a manifest with no components", async () => {
      const emptyManifest: VersionManifest = { version: "0.150.0", components: {} };
      vi.spyOn(idbCache, "getCached").mockResolvedValue(emptyManifest);

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toEqual([]);
    });
  });
});
