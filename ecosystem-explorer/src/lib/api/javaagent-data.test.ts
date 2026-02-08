import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import * as javaagentData from "./javaagent-data";
import * as idbCache from "./idb-cache";
import type { VersionsIndex, VersionManifest, InstrumentationData } from "@/types/javaagent";

declare const global: typeof globalThis;

describe("javaagent-data", () => {
  const mockVersionsIndex: VersionsIndex = {
    versions: [
      { version: "2.10.0", is_latest: true },
      { version: "2.9.0", is_latest: false },
    ],
  };

  const mockVersionManifest: VersionManifest = {
    version: "2.10.0",
    instrumentations: {
      "akka-actor": "abc123",
      "spring-webmvc": "def456",
    },
  };

  const mockInstrumentationData: InstrumentationData = {
    name: "akka-actor",
    display_name: "Akka Actor",
    description: "Instrumentation for Akka Actor",
    minimum_java_version: 8,
    scope: {
      name: "io.opentelemetry.akka-actor",
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    idbCache.closeDB();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    idbCache.closeDB();
  });

  describe("loadVersions", () => {
    it("should fetch and cache versions index on cache miss", async () => {
      const getCachedSpy = vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      const setCachedSpy = vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockVersionsIndex,
      });

      const result = await javaagentData.loadVersions();

      expect(result).toEqual(mockVersionsIndex);
      expect(getCachedSpy).toHaveBeenCalledWith("versions-index", idbCache.STORES.METADATA);
      expect(global.fetch).toHaveBeenCalledWith("/data/javaagent/versions-index.json");
      expect(setCachedSpy).toHaveBeenCalledWith(
        "versions-index",
        mockVersionsIndex,
        idbCache.STORES.METADATA
      );
    });

    it("should return cached data on cache hit without fetching", async () => {
      const getCachedSpy = vi.spyOn(idbCache, "getCached").mockResolvedValue(mockVersionsIndex);
      const setCachedSpy = vi.spyOn(idbCache, "setCached");

      const result = await javaagentData.loadVersions();

      expect(result).toEqual(mockVersionsIndex);
      expect(getCachedSpy).toHaveBeenCalledWith("versions-index", idbCache.STORES.METADATA);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(setCachedSpy).not.toHaveBeenCalled();
    });

    it("should propagate fetch errors", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(javaagentData.loadVersions()).rejects.toThrow(
        "Failed to load versions-index: 404 Not Found"
      );
    });

    it("should propagate network errors", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      await expect(javaagentData.loadVersions()).rejects.toThrow("Network error");
    });

    it("should deduplicate concurrent requests to the same resource", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      vi.spyOn(idbCache, "setCached").mockResolvedValue();

      let fetchResolve: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        fetchResolve = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(fetchPromise);

      const request1 = javaagentData.loadVersions();
      const request2 = javaagentData.loadVersions();
      const request3 = javaagentData.loadVersions();

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      fetchResolve!({
        ok: true,
        json: async () => mockVersionsIndex,
      });

      const [result1, result2, result3] = await Promise.all([request1, request2, request3]);

      expect(result1).toEqual(mockVersionsIndex);
      expect(result2).toEqual(mockVersionsIndex);
      expect(result3).toEqual(mockVersionsIndex);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle concurrent requests when one fails", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      const request1 = javaagentData.loadVersions();
      const request2 = javaagentData.loadVersions();

      await expect(Promise.all([request1, request2])).rejects.toThrow(
        "Failed to load versions-index: 500 Server Error"
      );
    });
  });

  describe("loadVersionManifest", () => {
    it("should fetch and cache version manifest on cache miss", async () => {
      const getCachedSpy = vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      const setCachedSpy = vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockVersionManifest,
      });

      const result = await javaagentData.loadVersionManifest("2.10.0");

      expect(result).toEqual(mockVersionManifest);
      expect(getCachedSpy).toHaveBeenCalledWith("manifest-2.10.0", idbCache.STORES.METADATA);
      expect(global.fetch).toHaveBeenCalledWith("/data/javaagent/versions/2.10.0-index.json");
      expect(setCachedSpy).toHaveBeenCalledWith(
        "manifest-2.10.0",
        mockVersionManifest,
        idbCache.STORES.METADATA
      );
    });

    it("should return cached data on cache hit", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(mockVersionManifest);

      const result = await javaagentData.loadVersionManifest("2.10.0");

      expect(result).toEqual(mockVersionManifest);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("loadInstrumentation", () => {
    it("should load instrumentation using manifest hash", async () => {
      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "manifest-2.10.0") return mockVersionManifest;
          if (key === "instrumentation-abc123") return mockInstrumentationData;
          return null;
        });

      const result = await javaagentData.loadInstrumentation("akka-actor", "2.10.0");

      expect(result).toEqual(mockInstrumentationData);
      expect(getCachedSpy).toHaveBeenCalledWith("manifest-2.10.0", idbCache.STORES.METADATA);
      expect(getCachedSpy).toHaveBeenCalledWith(
        "instrumentation-abc123",
        idbCache.STORES.INSTRUMENTATIONS
      );
    });

    it("should fetch instrumentation if not cached", async () => {
      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "manifest-2.10.0") return mockVersionManifest;
        return null;
      });
      vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockInstrumentationData,
      });

      const result = await javaagentData.loadInstrumentation("akka-actor", "2.10.0");

      expect(result).toEqual(mockInstrumentationData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/data/javaagent/instrumentations/akka-actor/akka-actor-abc123.json"
      );
    });

    it("should throw error for non-existent instrumentation", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(mockVersionManifest);

      await expect(javaagentData.loadInstrumentation("non-existent", "2.10.0")).rejects.toThrow(
        'Instrumentation "non-existent" not found in version 2.10.0'
      );
    });

    it("should accept an optional manifest parameter to avoid redundant loads", async () => {
      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "instrumentation-abc123") return mockInstrumentationData;
          return null;
        });

      const result = await javaagentData.loadInstrumentation(
        "akka-actor",
        "2.10.0",
        mockVersionManifest
      );

      expect(result).toEqual(mockInstrumentationData);
      const manifestCalls = getCachedSpy.mock.calls.filter((call) => call[0] === "manifest-2.10.0");
      expect(manifestCalls).toHaveLength(0);
    });

    it("should throw error for non-existent instrumentation when manifest is provided", async () => {
      await expect(
        javaagentData.loadInstrumentation("non-existent", "2.10.0", mockVersionManifest)
      ).rejects.toThrow('Instrumentation "non-existent" not found in version 2.10.0');
    });
  });

  describe("loadAllInstrumentations", () => {
    it("should load all instrumentations from manifest", async () => {
      const akkaData = {
        ...mockInstrumentationData,
        name: "akka-actor",
        scope: { name: "io.opentelemetry.akka-actor" },
      };
      const springData = {
        ...mockInstrumentationData,
        name: "spring-webmvc",
        scope: { name: "io.opentelemetry.spring-webmvc" },
      };

      vi.spyOn(idbCache, "getCached").mockImplementation(async (key: string) => {
        if (key === "manifest-2.10.0") return mockVersionManifest;
        if (key === "instrumentation-abc123") return akkaData;
        if (key === "instrumentation-def456") return springData;
        return null;
      });

      const result = await javaagentData.loadAllInstrumentations("2.10.0");

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(akkaData);
      expect(result).toContainEqual(springData);
    });

    it("should only load manifest once for all instrumentations", async () => {
      const akkaData = {
        ...mockInstrumentationData,
        name: "akka-actor",
        scope: { name: "io.opentelemetry.akka-actor" },
      };
      const springData = {
        ...mockInstrumentationData,
        name: "spring-webmvc",
        scope: { name: "io.opentelemetry.spring-webmvc" },
      };

      const getCachedSpy = vi
        .spyOn(idbCache, "getCached")
        .mockImplementation(async (key: string) => {
          if (key === "manifest-2.10.0") return mockVersionManifest;
          if (key === "instrumentation-abc123") return akkaData;
          if (key === "instrumentation-def456") return springData;
          return null;
        });

      await javaagentData.loadAllInstrumentations("2.10.0");

      const manifestCalls = getCachedSpy.mock.calls.filter((call) => call[0] === "manifest-2.10.0");
      expect(manifestCalls).toHaveLength(1);
    });

    it("should handle empty manifest", async () => {
      const emptyManifest: VersionManifest = { version: "2.10.0", instrumentations: {} };
      vi.spyOn(idbCache, "getCached").mockResolvedValue(emptyManifest);

      const result = await javaagentData.loadAllInstrumentations("2.10.0");

      expect(result).toEqual([]);
    });
  });
});
