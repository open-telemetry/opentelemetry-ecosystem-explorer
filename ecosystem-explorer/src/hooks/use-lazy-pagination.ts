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
const DEFAULT_ROOT_MARGIN = "200px";

export interface UseLazyPaginationOptions {
  totalCount: number;
  pageSize?: number;
  resetKey?: string;
  rootMargin?: string;
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
  rootMargin = DEFAULT_ROOT_MARGIN,
}: UseLazyPaginationOptions): UseLazyPaginationResult {
  const [visibleCount, setVisibleCount] = useState(() => initialVisibleCount(totalCount, pageSize));

  // Reset visibleCount when any input that determines the page window changes.
  // Done during render (not in an effect) so consumers never see a stale slice.
  const [resetSignature, setResetSignature] = useState({ resetKey, totalCount, pageSize });
  if (
    resetSignature.resetKey !== resetKey ||
    resetSignature.totalCount !== totalCount ||
    resetSignature.pageSize !== pageSize
  ) {
    setResetSignature({ resetKey, totalCount, pageSize });
    setVisibleCount(initialVisibleCount(totalCount, pageSize));
  }

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedNodeRef = useRef<HTMLElement | null>(null);

  const loadMore = useCallback(() => {
    setVisibleCount((current) => {
      if (current >= totalCount) return current;
      return Math.min(current + pageSize, totalCount);
    });
  }, [pageSize, totalCount]);

  const setSentinel = useCallback(
    (node: HTMLElement | null) => {
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
                loadMore();
                break;
              }
            }
          },
          { rootMargin }
        );
      }

      observerRef.current.observe(node);
      observedNodeRef.current = node;
    },
    [loadMore, rootMargin]
  );

  // Disconnect on unmount; also resets when loadMore identity changes so a new
  // observer is lazily recreated against the latest totalCount/pageSize.
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
        observedNodeRef.current = null;
      }
    };
  }, [loadMore, rootMargin]);

  return {
    visibleCount,
    setSentinel,
    hasMore: visibleCount < totalCount,
  };
}
