import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "otel-javaagent-cache";
const DB_VERSION = 1;

export const STORES = {
  METADATA: "metadata",
  INSTRUMENTATIONS: "instrumentations",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number; // unused for now, will use in future for cache eviction policies
}

let dbInstance: IDBPDatabase | null = null;
let dbInitPromise: Promise<IDBPDatabase> | null = null;
let dbInitFailed = false;

export async function initDB(): Promise<IDBPDatabase> {
  if (!isIDBAvailable()) {
    throw new Error("IndexedDB is not available in this environment");
  }

  if (dbInitFailed) {
    throw new Error("IndexedDB initialization previously failed");
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORES.METADATA)) {
            db.createObjectStore(STORES.METADATA, { keyPath: "key" });
          }

          if (!db.objectStoreNames.contains(STORES.INSTRUMENTATIONS)) {
            db.createObjectStore(STORES.INSTRUMENTATIONS, { keyPath: "key" });
          }
        },
      });

      dbInstance = db;
      dbInitPromise = null;
      return db;
    } catch (error) {
      dbInitFailed = true;
      dbInitPromise = null;
      console.error("Failed to initialize IndexedDB:", error);
      throw error;
    }
  })();

  return dbInitPromise;
}

export async function getCached<T>(key: string, store: StoreName): Promise<T | null> {
  try {
    const db = await initDB();
    const entry = await db.get(store, key);

    if (!entry) {
      return null;
    }

    return (entry as CacheEntry<T>).data;
  } catch (error) {
    console.error(`Failed to get cached data for ${key}:`, error);
    return null;
  }
}

export async function setCached<T>(key: string, data: T, store: StoreName): Promise<void> {
  try {
    const db = await initDB();

    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: Date.now(),
    };

    await db.put(store, entry);
  } catch (error) {
    console.error(`Failed to cache data for ${key}:`, error);
  }
}

export async function clearAllCached(): Promise<void> {
  try {
    const db = await initDB();
    await Promise.all([db.clear(STORES.METADATA), db.clear(STORES.INSTRUMENTATIONS)]);
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbInitPromise = null;
  dbInitFailed = false;
}

export function isIDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
