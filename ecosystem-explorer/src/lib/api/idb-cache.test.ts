import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { initDB, getCached, setCached, clearAllCached, closeDB, STORES } from "./idb-cache";

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
});
