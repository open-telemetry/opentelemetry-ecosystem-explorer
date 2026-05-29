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

function initialVisibleCount(totalCount: number, pageSize: number): number {
  return ioSupported() ? Math.min(pageSize, totalCount) : totalCount;
}

export function useLazyPagination({
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = "",
}: UseLazyPaginationOptions): UseLazyPaginationResult {
  const [visibleCount, setVisibleCount] = useState(() => initialVisibleCount(totalCount, pageSize));

  // visibleCount initialised above.

  const loadMore = useCallback(() => {
    setVisibleCount((current) => {
      if (current >= totalCount) return current;
      return Math.min(current + pageSize, totalCount);
    });
  }, [pageSize, totalCount]);

  // Mirror the latest loadMore into a ref so the IO callback (captured once at
  // first sentinel attach) always sees the up-to-date closure. Without this,
  // an observer created when totalCount=0 would keep calling a loadMore that
  // can never advance past 0.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedNodeRef = useRef<HTMLElement | null>(null);

  // Reset visibleCount when any input that determines the page window changes.
  // Use a ref + effect to perform the reset and safely recreate the observer
  // outside of render, avoiding races where a still-intersecting sentinel
  // immediately advances pagination after a reset.
  const prevSignatureRef = useRef({ resetKey, totalCount, pageSize });
  useEffect(() => {
    const prev = prevSignatureRef.current;
    if (
      prev.resetKey !== resetKey ||
      prev.totalCount !== totalCount ||
      prev.pageSize !== pageSize
    ) {
      prevSignatureRef.current = { resetKey, totalCount, pageSize };
      setVisibleCount(initialVisibleCount(totalCount, pageSize));

      // If an observer is currently attached, recreate it so any currently
      // intersecting state is cleared. This prevents an immediate loadMore()
      // from firing as a side-effect of a pagination reset.
      if (ioSupported() && observerRef.current && observedNodeRef.current) {
        try {
          observerRef.current.disconnect();
        } catch {
          // ignore errors from disconnect in exotic environments
        }
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
        observerRef.current.observe(observedNodeRef.current as Element);
      }
    }
  }, [resetKey, totalCount, pageSize]);

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
