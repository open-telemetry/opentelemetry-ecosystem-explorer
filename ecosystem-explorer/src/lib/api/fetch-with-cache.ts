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

/**
 * Validates a path segment to prevent path traversal attacks.
 * Only allows alphanumeric characters, dots, underscores, and hyphens.
 */
export function validatePathSegment(segment: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment) || segment.includes("..")) {
    throw new Error(`Invalid path segment: ${segment}`);
  }
}

/**
 * Resolves a data path by combining BASE_URL with path segments.
 * Centralizes security validation and path construction.
 */
export function resolveDataPath(base: string, ...segments: string[]): string {
  const baseUrl = import.meta.env.BASE_URL || "";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const parts = [normalizedBase, base.startsWith("/") ? base.slice(1) : base];
  for (const segment of segments) {
    validatePathSegment(segment);
    parts.push(segment);
  }
  return parts.join("/");
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

async function fetchWithRetry(
  url: string,
  retries = DEFAULT_MAX_RETRIES,
  delayMs = DEFAULT_RETRY_DELAY_MS
): Promise<Response> {
  const maxAttempts = Math.max(1, retries);
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // HTTP responses (ok or non-ok) are returned immediately - no retry.
      // Only real network failures (catch block) trigger retries.
      return await fetch(url);
    } catch (error) {
      lastError = error;
      if (i === maxAttempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
  }
  throw lastError;
}

export interface FetchWithCacheOptions<T = unknown> {
  allow404?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
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
          if (!options?.validate) return cachedData;
          try {
            if (options.validate(cachedData)) return cachedData;
          } catch {
            // validator exception = treat as invalid
          }
        }
      }

      let response: Response;
      try {
        response = await fetchWithRetry(url, options?.retryCount, options?.retryDelayMs);
      } catch (error) {
        if (isIDBAvailable()) {
          const staleData = await getCached<T>(cacheKey, storeType, { allowExpired: true });
          if (staleData !== null) {
            if (options?.validate && !options.validate(staleData)) throw error;
            console.warn("Network error, serving stale cache:", cacheKey, error);
            return staleData;
          }
        }
        throw error;
      }

      if (!response.ok) {
        if (response.status === 404 && options?.allow404) return null;

        if (isIDBAvailable()) {
          const staleData = await getCached<T>(cacheKey, storeType, { allowExpired: true });
          if (staleData !== null) {
            if (options?.validate && !options.validate(staleData)) {
              throw new Error(
                `Failed to load ${cacheKey}: ${response.status} ${response.statusText}`
              );
            }
            console.warn("HTTP error, serving stale cache:", { cacheKey, status: response.status });
            return staleData;
          }
        }
        throw new Error(`Failed to load ${cacheKey}: ${response.status} ${response.statusText}`);
      }

      // SPA 200 fallback: CDNs can return 200 + HTML during deployment propagation.
      // Use optional chaining so test mocks without headers don't crash.
      const contentType = response.headers?.get?.("content-type") ?? "";
      if (contentType.includes("text/html")) {
        if (isIDBAvailable()) {
          const staleData = await getCached<T>(cacheKey, storeType, { allowExpired: true });
          if (staleData !== null) {
            if (options?.validate && !options.validate(staleData)) {
              throw new Error(
                `Failed to load ${cacheKey}: unexpected content-type "${contentType}"`
              );
            }
            console.warn("CDN returned non-JSON 200, serving stale cache:", {
              cacheKey,
              contentType,
            });
            return staleData;
          }
        }
        throw new Error(`Failed to load ${cacheKey}: unexpected content-type "${contentType}"`);
      }

      const data = await response.json();
      if (isIDBAvailable()) {
        try {
          await setCached(cacheKey, data, storeType);
        } catch {
          // Cache write failures must not block data loading
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
