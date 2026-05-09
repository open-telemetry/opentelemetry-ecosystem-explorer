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
import { getCached, setCached, isIDBAvailable, type StoreName } from "./idb-cache";

const inflightRequests = new Map<string, Promise<unknown>>();

export interface FetchWithCacheOptions<T = unknown> {
  allow404?: boolean;
  /**
   * Optional validator for cached data. When provided, cached data that fails
   * validation is ignored for the current request and a fresh network request
   * is made. This prevents stale or logically-empty cached responses (e.g.
   * `{ versions: [] }`) from being served to the caller.
   */
  validate?: (data: T) => boolean;
}

export async function fetchWithCache<T>(
  cacheKey: string,
  url: string,
  storeType: StoreName,
  options?: FetchWithCacheOptions<T>
): Promise<T | null> {
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey) as Promise<T | null>;
  }

  const request = (async () => {
    try {
      if (isIDBAvailable()) {
        const cachedData = await getCached<T>(cacheKey, storeType);
        if (cachedData !== null) {
          if (!options?.validate) {
            return cachedData;
          }
          try {
            if (options.validate(cachedData)) {
              return cachedData;
            }
          } catch {
            // treat validator exceptions as validation failures and fall back to network fetch
          }
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404 && options?.allow404) {
          return null;
        }
        throw new Error(`Failed to load ${cacheKey}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (isIDBAvailable()) {
        try {
          await setCached(cacheKey, data, storeType);
        } catch {
          // Cache write failure should not break data loading
        }
      }

      return data;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, request);
  return request;
}
