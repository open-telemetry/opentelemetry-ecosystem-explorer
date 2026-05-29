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
import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_PAGE_SIZE = 24;

// Eager pre-fetch margin so loading starts before the user reaches the very
// bottom of the visible list. Treated as immutable; not exposed in the public
// options because making it dynamic would require disconnecting/recreating the
// IntersectionObserver, and no caller currently needs that.
const ROOT_MARGIN = "200px";

export interface UseLazyPaginationOptions {
  totalCount: number;
  pageSize?: number;
  resetKey?: string;
}

export interface UseLazyPaginationResult {
  visibleCount: number;
  setSentinel: (node: HTMLElement | null) => void;
  hasMore: boolean;
}

function ioSupported(): boolean {
  return typeof IntersectionObserver !== "undefined";
}

interface Tracker {
  key: string;
  pages: number;
}

export function useLazyPagination({
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = "",
}: UseLazyPaginationOptions): UseLazyPaginationResult {
  // The tracker persists how many pages have been loaded for a given resetKey.
  // When `resetKey` no longer matches the stored key, derived state simply
  // treats the stored page count as stale (effective value = 1). This avoids
  // any setState during render — the rule called out in
  // .github/instructions/typescript-frontend.instructions.md.
  const [tracker, setTracker] = useState<Tracker>({ key: resetKey, pages: 1 });

  const matchesCurrentKey = tracker.key === resetKey;
  const effectivePages = matchesCurrentKey ? tracker.pages : 1;

  const visibleCount = ioSupported() ? Math.min(effectivePages * pageSize, totalCount) : totalCount;

  const loadMore = useCallback(() => {
    setTracker((prev) => {
      // When resetKey has just changed and we haven't synced the tracker yet,
      // treat current pages as 1 (the first page is already showing) and
      // advance from there. The result is always anchored to the live key.
      const prevPages = prev.key === resetKey ? prev.pages : 1;
      return { key: resetKey, pages: prevPages + 1 };
    });
  }, [resetKey]);

  // Mirror the latest loadMore into a ref so the IO callback (captured once at
  // first sentinel attach) always sees the up-to-date closure. Without this,
  // an observer created when resetKey="A" would keep calling the loadMore from
  // that closure forever.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedNodeRef = useRef<HTMLElement | null>(null);

  // Stable callback: no dependencies. React attaches/detaches the sentinel ref
  // exactly once for the component lifetime, so the observer is created once.
  const setSentinel = useCallback((node: HTMLElement | null) => {
    if (!ioSupported()) return;

    if (observerRef.current && observedNodeRef.current) {
      observerRef.current.unobserve(observedNodeRef.current);
      observedNodeRef.current = null;
    }

    if (!node) return;

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              loadMoreRef.current();
              break;
            }
          }
        },
        { rootMargin: ROOT_MARGIN }
      );
    }

    observerRef.current.observe(node);
    observedNodeRef.current = node;
  }, []);

  // Disconnect on unmount only. Earlier versions also depended on
  // [loadMore, rootMargin] — that caused a race where an observer freshly
  // attached in the same commit got immediately torn down when totalCount went
  // from 0 to N (data arrival).
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
        observedNodeRef.current = null;
      }
    };
  }, []);

  return {
    visibleCount,
    setSentinel,
    hasMore: visibleCount < totalCount,
  };
}
