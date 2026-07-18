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
import type { VersionManifest, VersionsIndex, CollectorComponent } from "@/types/collector";

declare const global: typeof globalThis;

describe("collector-data", () => {
  // versions-index WITHOUT a bundle hash forces the per-component fan-out path.
  const versionsIndexNoBundle: VersionsIndex = {
    versions: [{ version: "0.150.0", is_latest: true }],
  };
  // versions-index WITH a bundle hash takes the single-request bundle path.
  const versionsIndexWithBundle: VersionsIndex = {
    versions: [{ version: "0.150.0", is_latest: true, bundle_hash: "bundlehash" }],
  };

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
    status: {
      class: "receiver",
      // Mixed stability levels: deriveStability must pick the highest-ranked ("beta").
      stability: { beta: ["traces"], alpha: ["metrics"] },
      distributions: ["core"],
    },
  };

  const otlpHttpExporter: CollectorComponent = {
    id: "contrib-otlphttpexporter",
    name: "otlphttpexporter",
    ecosystem: "collector",
    type: "exporter",
    distribution: "contrib",
  };

  // The slim IndexComponent the fan-out projects each full component into.
  const otlpReceiverIndex = {
    id: "core-otlpreceiver",
    name: "otlpreceiver",
    distribution: "core",
    type: "receiver",
    stability: "beta",
    signals: ["traces", "metrics"],
  };
  const otlpHttpExporterIndex = {
    id: "contrib-otlphttpexporter",
    name: "otlphttpexporter",
    distribution: "contrib",
    type: "exporter",
    stability: null,
    signals: [],
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

  describe("loadAllComponents (bundle path)", () => {
    it("loads the single per-version bundle when the index advertises a bundle hash", async () => {
      const bundle = [otlpReceiverIndex, otlpHttpExporterIndex];
      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "collector-versions-index") return versionsIndexWithBundle;
          if (key === "collector-bundle-0.150.0-bundlehash") return bundle;
          return null;
        });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toEqual(bundle);
      expect(getCachedSpy).toHaveBeenCalledWith(
        "collector-bundle-0.150.0-bundlehash",
        idbCache.STORES.INSTRUMENTATIONS
      );
      // The manifest fan-out must not run when the bundle succeeds.
      const manifestCalls = getCachedSpy.mock.calls.filter(
        (call) => call[0] === "collector-manifest-0.150.0"
      );
      expect(manifestCalls).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("falls back to the fan-out when the bundle fetch fails", async () => {
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "collector-versions-index") return versionsIndexWithBundle;
        // Bundle is not cached; the network fetch (below) 404s, forcing fallback.
        if (key === "collector-manifest-0.150.0") return mockVersionManifest;
        if (key === "collector-component-hash1") return otlpReceiver;
        if (key === "collector-component-hash2") return otlpHttpExporter;
        return null;
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toEqual([otlpReceiverIndex, otlpHttpExporterIndex]);
    });
  });

  describe("loadAllComponents (fan-out fallback)", () => {
    it("projects components to the slim index shape in manifest order", async () => {
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "collector-versions-index") return versionsIndexNoBundle;
        if (key === "collector-manifest-0.150.0") return mockVersionManifest;
        if (key === "collector-component-hash1") return otlpReceiver;
        if (key === "collector-component-hash2") return otlpHttpExporter;
        return null;
      });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toHaveLength(2);
      // Order matches the manifest's component-id order, not fetch completion.
      expect(result.map((c) => c.id)).toEqual(["core-otlpreceiver", "contrib-otlphttpexporter"]);
      // deriveStability picks the highest-ranked level present (beta over alpha).
      expect(result[0]).toEqual(otlpReceiverIndex);
      expect(result[1]).toEqual(otlpHttpExporterIndex);
    });

    it("loads the manifest only once for all components", async () => {
      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "collector-versions-index") return versionsIndexNoBundle;
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
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "collector-versions-index") return versionsIndexNoBundle;
        if (key === "collector-manifest-0.150.0") return emptyManifest;
        return null;
      });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result).toEqual([]);
    });

    it("derives signals in canonical order, deduped across stability levels", async () => {
      const sparkReceiver: CollectorComponent = {
        id: "contrib-apachesparkreceiver",
        name: "apachesparkreceiver",
        ecosystem: "collector",
        type: "receiver",
        distribution: "contrib",
        status: {
          class: "receiver",
          stability: { beta: ["metrics", "traces"], alpha: ["profiles", "metrics"] },
          distributions: ["contrib"],
        },
      };
      const manifest: VersionManifest = {
        version: "0.150.0",
        components: { "contrib-apachesparkreceiver": "hash3" },
      };
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "collector-versions-index") return versionsIndexNoBundle;
        if (key === "collector-manifest-0.150.0") return manifest;
        if (key === "collector-component-hash3") return sparkReceiver;
        return null;
      });

      const result = await collectorData.loadAllComponents("0.150.0");

      expect(result[0].signals).toEqual(["traces", "metrics", "profiles"]);
    });
  });
});
