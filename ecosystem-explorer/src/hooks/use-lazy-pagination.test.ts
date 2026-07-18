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
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLazyPagination } from "./use-lazy-pagination";

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

interface IOInstance {
  callback: IOCallback;
  observed: Element[];
  trigger: (intersecting?: boolean) => void;
}

let instances: IOInstance[] = [];
const originalIO = globalThis.IntersectionObserver;

function installIOMock() {
  instances = [];
  class MockIO {
    callback: IOCallback;
    observed: Element[] = [];
    constructor(cb: IOCallback) {
      this.callback = cb;
      const instance: IOInstance = {
        callback: cb,
        observed: this.observed,
        trigger: (intersecting = true) => {
          this.callback(
            this.observed.map(
              (el) => ({ isIntersecting: intersecting, target: el }) as IntersectionObserverEntry
            )
          );
        },
      };
      instances.push(instance);
    }
    observe(el: Element) {
      this.observed.push(el);
    }
    unobserve(el: Element) {
      this.observed = this.observed.filter((o) => o !== el);
    }
    disconnect() {
      this.observed = [];
    }
    takeRecords() {
      return [] as IntersectionObserverEntry[];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
}

function uninstallIO() {
  (
    globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }
  ).IntersectionObserver = undefined;
}

function restoreIO() {
  (
    globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }
  ).IntersectionObserver = originalIO;
}

describe("useLazyPagination", () => {
  beforeEach(() => {
    installIOMock();
  });

  afterEach(() => {
    restoreIO();
    vi.restoreAllMocks();
  });

  it("returns pageSize as visibleCount when totalCount exceeds pageSize", () => {
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 100, pageSize: 24, resetKey: "k1" })
    );
    expect(result.current.visibleCount).toBe(24);
    expect(result.current.hasMore).toBe(true);
  });

  it("returns totalCount when it is less than or equal to pageSize", () => {
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 5, pageSize: 24, resetKey: "k1" })
    );
    expect(result.current.visibleCount).toBe(5);
    expect(result.current.hasMore).toBe(false);
  });

  it("loads the next page when the sentinel intersects", () => {
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 100, pageSize: 24, resetKey: "k1" })
    );

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });

    act(() => {
      instances[instances.length - 1].trigger(true);
    });

    expect(result.current.visibleCount).toBe(48);
    expect(result.current.hasMore).toBe(true);
  });

  it("clamps visibleCount to totalCount across multiple intersections", () => {
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 50, pageSize: 24, resetKey: "k1" })
    );

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });

    act(() => {
      instances[instances.length - 1].trigger(true);
    });
    expect(result.current.visibleCount).toBe(48);

    act(() => {
      instances[instances.length - 1].trigger(true);
    });
    expect(result.current.visibleCount).toBe(50);
    expect(result.current.hasMore).toBe(false);

    act(() => {
      instances[instances.length - 1].trigger(true);
    });
    expect(result.current.visibleCount).toBe(50);
  });

  it("does not advance when the entry is not intersecting", () => {
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 100, pageSize: 24, resetKey: "k1" })
    );

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });

    act(() => {
      instances[instances.length - 1].trigger(false);
    });

    expect(result.current.visibleCount).toBe(24);
  });

  it("resets visibleCount when resetKey changes", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useLazyPagination({ totalCount: 100, pageSize: 24, resetKey: key }),
      { initialProps: { key: "k1" } }
    );

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });
    act(() => {
      instances[instances.length - 1].trigger(true);
    });
    expect(result.current.visibleCount).toBe(48);

    rerender({ key: "k2" });
    expect(result.current.visibleCount).toBe(24);
  });

  it("keeps the observer alive when totalCount grows from 0 (data-arrival race)", () => {
    // Regression: loadMore identity changes when totalCount goes 0 -> N. A
    // cleanup effect with [loadMore] deps previously disconnected the observer
    // right after setSentinel had created it, leaving the sentinel mounted
    // but un-observed.
    const { result, rerender } = renderHook(
      ({ totalCount }: { totalCount: number }) =>
        useLazyPagination({ totalCount, pageSize: 24, resetKey: "k" }),
      { initialProps: { totalCount: 0 } }
    );

    rerender({ totalCount: 80 });

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });

    expect(instances).toHaveLength(1);
    expect(instances[0].observed).toHaveLength(1);

    act(() => {
      instances[instances.length - 1].trigger(true);
    });

    expect(result.current.visibleCount).toBe(48);
    expect(result.current.hasMore).toBe(true);
  });

  it("falls back to rendering everything when IntersectionObserver is unavailable", () => {
    uninstallIO();
    const { result } = renderHook(() =>
      useLazyPagination({ totalCount: 100, pageSize: 24, resetKey: "k1" })
    );
    expect(result.current.visibleCount).toBe(100);
    expect(result.current.hasMore).toBe(false);

    act(() => {
      const node = document.createElement("div");
      result.current.setSentinel(node);
    });
    expect(instances).toHaveLength(0);
  });
});
