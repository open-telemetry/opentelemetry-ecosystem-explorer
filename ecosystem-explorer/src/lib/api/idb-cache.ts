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
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "otel-explorer-cache";
const DB_VERSION = 8;
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PRUNE_KEY = "__internal_last_pruned_at";

export const STORES = {
  METADATA: "metadata",
  INSTRUMENTATIONS: "instrumentations",
  CONFIGURATION: "configuration",
  GLOBAL_CONFIGURATIONS: "global-configurations",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
  lastAccessedAt?: number;
}

let dbInstance: IDBPDatabase | null = null;
let dbInitPromise: Promise<IDBPDatabase> | null = null;
let dbInitFailed = false;

function isExpired(cachedAt: number): boolean {
  const now = Date.now();
  if (cachedAt > now) return true;
  return now - cachedAt > CACHE_EXPIRATION_MS;
}

export async function initDB(): Promise<IDBPDatabase> {
  if (!isIDBAvailable()) {
    throw new Error("IndexedDB is not available in this environment");
  }
  if (dbInitFailed) {
    throw new Error("IndexedDB initialization previously failed");
  }
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          for (const storeName of Object.values(STORES)) {
            if (db.objectStoreNames.contains(storeName)) {
              db.deleteObjectStore(storeName);
            }
            db.createObjectStore(storeName, { keyPath: "key" });
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

export async function getCached<T>(
  key: string,
  store: StoreName,
  options?: { allowExpired?: boolean }
): Promise<T | null> {
  try {
    const db = await initDB();
    const entry = await db.get(store, key);
    if (!entry) return null;

    const cacheEntry = entry as CacheEntry<T>;
    if (isExpired(cacheEntry.cachedAt)) {
      if (options?.allowExpired) {
        const now = Date.now();
        const lastAccessed = cacheEntry.lastAccessedAt ?? 0;
        if (now - lastAccessed > 60 * 60 * 1000) {
          cacheEntry.lastAccessedAt = now;
          db.put(store, cacheEntry).catch(() => {});
        }
        return cacheEntry.data;
      }
      return null;
    }

    const now = Date.now();
    const lastAccessed = cacheEntry.lastAccessedAt ?? 0;
    if (now - lastAccessed > 60 * 60 * 1000) {
      cacheEntry.lastAccessedAt = now;
      db.put(store, cacheEntry).catch(() => {});
    }
    return cacheEntry.data;
  } catch (error) {
    console.error(`Failed to get cached data for %s:`, key, error);
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
      lastAccessedAt: Date.now(),
    };
    await db.put(store, entry);
  } catch (error) {
    console.error(`Failed to cache data for %s:`, key, error);
  }
}

export async function clearAllCached(): Promise<void> {
  try {
    const db = await initDB();
    await Promise.all(Object.values(STORES).map((store) => db.clear(store)));
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

/**
 * Removes entries not accessed within `maxAgeDays` days.
 * A 24-hour frequency guard prevents excessive disk I/O on every navigation.
 */
export async function pruneOldEntries(maxAgeDays = 7): Promise<void> {
  try {
    const db = await initDB();
    const now = Date.now();

    const lastPruneEntry = await db.get(STORES.METADATA, PRUNE_KEY);
    if (lastPruneEntry) {
      const lastPrunedAt = (lastPruneEntry as CacheEntry<number>).data;
      if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
    }

    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    for (const store of Object.values(STORES)) {
      const tx = db.transaction(store, "readwrite");
      let cursor = await tx.store.openCursor();

      while (cursor) {
        const entry = cursor.value as CacheEntry<unknown>;
        if (entry.key === PRUNE_KEY) {
          cursor = await cursor.continue();
          continue;
        }
        // Coalesce: prefer lastAccessedAt, fall back to cachedAt for older entries
        const lastAccessed = entry.lastAccessedAt ?? entry.cachedAt;
        if (now - lastAccessed > maxAgeMs) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }
      await tx.done;
    }

    await db.put(STORES.METADATA, {
      key: PRUNE_KEY,
      data: now,
      cachedAt: now,
      lastAccessedAt: now,
    });
  } catch (error) {
    console.error("Failed to prune old cache entries:", error);
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
