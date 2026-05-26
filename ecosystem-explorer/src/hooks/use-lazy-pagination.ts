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

  // Mirror the latest loadMore into a ref so the IO callback (created once,
  // captured at first sentinel attach) always sees the up-to-date version.
  // Without this, an observer created when totalCount=0 would keep its stale
  // closure forever and never advance visibleCount.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Stable callback: depends only on rootMargin (which is stable for the
  // component's lifetime in practice). Keeping this stable means React only
  // attaches the ref once, so the observer isn't churned across renders.
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
                loadMoreRef.current();
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
    [rootMargin]
  );

  // Tear down the observer only on unmount. It used to also depend on
  // [loadMore, rootMargin], which caused a fatal race: when totalCount went
  // from 0 -> N (data arrival), loadMore identity changed, this cleanup ran
  // AFTER setSentinel had just attached an observer in the same commit, and
  // the freshly created observer was disconnected. The sentinel then stayed
  // mounted but unobserved — scrolling did nothing.
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
