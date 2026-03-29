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
import * as configData from "./configuration-data";
import * as idbCache from "./idb-cache";
import type { ConfigVersionsIndex, GroupNode } from "@/types/configuration";

declare const global: typeof globalThis;

describe("configuration-data", () => {
  const mockVersionsIndex: ConfigVersionsIndex = {
    versions: [{ version: "1.0.0", is_latest: true }],
  };

  const mockSchema: GroupNode = {
    controlType: "group",
    key: "root",
    label: "Root",
    path: "",
    children: [
      {
        controlType: "text_input",
        key: "file_format",
        label: "File Format",
        path: "file_format",
        required: true,
      },
    ],
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

  describe("loadConfigVersions", () => {
    it("should fetch versions index", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockVersionsIndex,
      });

      const result = await configData.loadConfigVersions();

      expect(result).toEqual(mockVersionsIndex);
      expect(global.fetch).toHaveBeenCalledWith("/data/configuration/versions-index.json");
    });

    it("should return cached versions on cache hit", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(mockVersionsIndex);

      const result = await configData.loadConfigVersions();

      expect(result).toEqual(mockVersionsIndex);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("loadConfigSchema", () => {
    it("should fetch schema for a version", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockSchema,
      });

      const result = await configData.loadConfigSchema("1.0.0");

      expect(result).toEqual(mockSchema);
      expect(global.fetch).toHaveBeenCalledWith("/data/configuration/versions/1.0.0.json");
    });

    it("should cache schema in CONFIGURATION store", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);
      const setCachedSpy = vi.spyOn(idbCache, "setCached").mockResolvedValue();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockSchema,
      });

      await configData.loadConfigSchema("1.0.0");

      expect(setCachedSpy).toHaveBeenCalledWith(
        "config-schema-1.0.0",
        mockSchema,
        idbCache.STORES.CONFIGURATION
      );
    });

    it("should return cached schema on cache hit", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(mockSchema);

      const result = await configData.loadConfigSchema("1.0.0");

      expect(result).toEqual(mockSchema);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should propagate fetch errors", async () => {
      vi.spyOn(idbCache, "getCached").mockResolvedValue(null);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(configData.loadConfigSchema("1.0.0")).rejects.toThrow(
        "Failed to load config-schema-1.0.0: 500 Internal Server Error"
      );
    });
  });
});
