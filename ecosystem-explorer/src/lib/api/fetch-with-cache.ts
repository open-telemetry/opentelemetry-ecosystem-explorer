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
 * Rejects segments containing '..' or characters outside the safe set (alphanumeric, dots, underscores, and hyphens).
 */
// Security: Prevent path traversal by strictly validating all dynamic path segments.
// CodeQL: This is an extra layer of protection to ensure all externally-provided
// strings are strictly alphanumeric before being used in a fetch() URL.
export function validatePathSegment(segment: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment) || segment.includes("..")) {
    throw new Error(`Invalid path segment: ${segment}`);
  }
}

/**
 * Resolves a data path by combining the base URL with segments.
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
  delayMs = DEFAULT_RETRY_DELAY_MS,
  allow404 = false
): Promise<Response> {
  const maxAttempts = Math.max(1, retries);
  let lastResponse: Response | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      lastResponse = await fetch(url);
      if (lastResponse.ok || (lastResponse.status === 404 && allow404) || i === maxAttempts - 1) {
        return lastResponse;
      }
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
  }
  return lastResponse!;
}

export interface FetchWithCacheOptions<T = unknown> {
  allow404?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
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

      let response: Response;
      try {
        response = await fetchWithRetry(
          url,
          options?.retryCount,
          options?.retryDelayMs,
          options?.allow404
        );
      } catch (error) {
        if (isIDBAvailable()) {
          const staleData = await getCached<T>(cacheKey, storeType, { allowExpired: true });
          if (staleData !== null) {
            if (options?.validate && !options.validate(staleData)) {
              throw error;
            }
            console.warn("Failed to fetch, falling back to stale cache:", cacheKey, error);
            return staleData;
          }
        }
        throw error;
      }

      if (!response.ok) {
        if (response.status === 404 && options?.allow404) {
          return null;
        }

        if (isIDBAvailable()) {
          const staleData = await getCached<T>(cacheKey, storeType, { allowExpired: true });
          if (staleData !== null) {
            if (options?.validate && !options.validate(staleData)) {
              throw new Error(
                `Failed to load ${cacheKey}: ${response.status} ${response.statusText}`
              );
            }
            console.warn("Failed to load, falling back to stale cache:", {
              cacheKey,
              status: response.status,
            });
            return staleData;
          }
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
