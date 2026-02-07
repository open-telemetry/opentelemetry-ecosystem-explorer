import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  initDB,
  getCached,
  setCached,
  clearAllCached,
  closeDB,
  isIDBAvailable,
  STORES,
} from "./idb-cache";

describe("idb-cache", () => {
  beforeEach(async () => {
    closeDB();

    await new Promise<void>((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase("otel-javaagent-cache");
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => resolve();
    });
  });

  afterEach(() => {
    closeDB();
  });

  describe("initDB", () => {
    it("should create database with correct name and version and stores", async () => {
      const db = await initDB();

      expect(db.name).toBe("otel-javaagent-cache");
      expect(db.version).toBe(1);

      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain("metadata");
      expect(storeNames).toContain("instrumentations");
    });

    it("should reinitialize after closeDB is called", async () => {
      const db1 = await initDB();

      closeDB();
      const db2 = await initDB();

      expect(db1).not.toBe(db2);
      expect(db2.name).toBe("otel-javaagent-cache");
    });
  });

  describe("setCached and getCached", () => {
    it("should store and retrieve data from instrumentations store", async () => {
      const key = "test-instrumentation";
      const data = { name: "akka-actor", version: "1.0.0" };

      await setCached(key, data, STORES.INSTRUMENTATIONS);
      const result = await getCached<typeof data>(key, STORES.INSTRUMENTATIONS);

      expect(result).toEqual(data);
    });

    it("should store and retrieve data from metadata store", async () => {
      const key = "versions-index";
      const data = { versions: [{ version: "2.10.0", is_latest: true }] };

      await setCached(key, data, STORES.METADATA);
      const result = await getCached<typeof data>(key, STORES.METADATA);

      expect(result).toEqual(data);
    });

    it("should return null for non-existent keys", async () => {
      const result = await getCached("non-existent-key", STORES.INSTRUMENTATIONS);

      expect(result).toBeNull();
    });

    it("should handle complex nested objects", async () => {
      const key = "complex-data";
      const data = {
        name: "spring-webmvc",
        nested: {
          configurations: [{ name: "endpoint", type: "string", default: "/actuator" }],
        },
        tags: ["http", "spring"],
        metadata: null,
      };

      await setCached(key, data, STORES.INSTRUMENTATIONS);
      const result = await getCached<typeof data>(key, STORES.INSTRUMENTATIONS);

      expect(result).toEqual(data);
    });

    it("should overwrite existing data when key is reused", async () => {
      const key = "overwrite-test";
      const oldData = { value: "old" };
      const newData = { value: "new" };

      await setCached(key, oldData, STORES.METADATA);
      await setCached(key, newData, STORES.METADATA);
      const result = await getCached<typeof newData>(key, STORES.METADATA);

      expect(result).toEqual(newData);
      expect(result).not.toEqual(oldData);
    });
  });

  describe("clearAllCached", () => {
    it("should clear all data from both stores", async () => {
      await setCached("meta-key", { data: "meta" }, STORES.METADATA);
      await setCached("inst-key", { data: "inst" }, STORES.INSTRUMENTATIONS);

      await clearAllCached();

      const metaResult = await getCached("meta-key", STORES.METADATA);
      const instResult = await getCached("inst-key", STORES.INSTRUMENTATIONS);
      expect(metaResult).toBeNull();
      expect(instResult).toBeNull();
    });

    it("should handle clearing empty stores", async () => {
      await expect(clearAllCached()).resolves.not.toThrow();
    });
  });

  describe("isIDBAvailable", () => {
    it("should return true when indexedDB is available", () => {
      // fake-indexeddb makes indexedDB available in test environment
      expect(isIDBAvailable()).toBe(true);
    });
  });

  describe("closeDB", () => {
    it("should allow operations after close", async () => {
      await initDB();
      closeDB();

      // should reinitialize automatically
      await expect(
        setCached("test", { data: "value" }, STORES.INSTRUMENTATIONS)
      ).resolves.not.toThrow();
      const result = await getCached("test", STORES.INSTRUMENTATIONS);
      expect(result).toEqual({ data: "value" });
    });
  });

  describe("type safety", () => {
    it("should preserve type information through cache", async () => {
      interface TestType {
        id: number;
        name: string;
        optional?: string;
      }

      const key = "typed-data";
      const data: TestType = { id: 1, name: "test" };

      await setCached<TestType>(key, data, STORES.INSTRUMENTATIONS);
      const result = await getCached<TestType>(key, STORES.INSTRUMENTATIONS);

      expect(result).toEqual(data);
      // TypeScript should infer result as TestType | null
      if (result) {
        expect(typeof result.id).toBe("number");
        expect(typeof result.name).toBe("string");
      }
    });
  });
});
