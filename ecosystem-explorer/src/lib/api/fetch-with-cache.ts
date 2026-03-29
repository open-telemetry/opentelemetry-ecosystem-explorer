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

export async function fetchWithCache<T>(
  cacheKey: string,
  url: string,
  storeType: StoreName
): Promise<T> {
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey) as Promise<T>;
  }

  const request = (async () => {
    try {
      if (isIDBAvailable()) {
        const cachedData = await getCached<T>(cacheKey, storeType);
        if (cachedData !== null) {
          inflightRequests.delete(cacheKey);
          return cachedData;
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
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

      inflightRequests.delete(cacheKey);
      return data;
    } catch (error) {
      inflightRequests.delete(cacheKey);
      throw error;
    }
  })();

  inflightRequests.set(cacheKey, request);
  return request;
}
