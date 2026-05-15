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
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
}

let dbInstance: IDBPDatabase | null = null;
let dbInitPromise: Promise<IDBPDatabase> | null = null;
let dbInitFailed = false;

function isExpired(cachedAt: number): boolean {
  const now = Date.now();
  if (cachedAt > now) {
    return true;
  }
  return now - cachedAt > CACHE_EXPIRATION_MS;
}

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
          const stores = Object.values(STORES);
          stores.forEach((storeName) => {
            if (db.objectStoreNames.contains(storeName)) {
              db.deleteObjectStore(storeName);
            }
            db.createObjectStore(storeName, { keyPath: "key" });
          });
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

    const cacheEntry = entry as CacheEntry<T>;
    if (isExpired(cacheEntry.cachedAt)) {
      await db.delete(store, key);
      return null;
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
    };

    await db.put(store, entry);
  } catch (error) {
    console.error(`Failed to cache data for %s:`, key, error);
  }
}

export async function clearAllCached(): Promise<void> {
  try {
    const db = await initDB();
    const stores = Object.values(STORES);
    await Promise.all(stores.map((store) => db.clear(store)));
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
