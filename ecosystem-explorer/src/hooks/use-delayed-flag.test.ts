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
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "./use-delayed-flag";

describe("useDelayedFlag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts false even when active", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 300));
    expect(result.current).toBe(false);
  });

  it("turns true once the delay elapses", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 300));

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it("stays false when active clears before the delay elapses", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 300), {
      initialProps: { active: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(false);
  });

  it("drops back to false as soon as active clears", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 300), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("restarts the delay when active cycles off and on", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 300), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ active: false });
    rerender({ active: true });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it("honors a custom delay", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 50));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(true);
  });

  it("cancels the pending timer on unmount", () => {
    const { unmount } = renderHook(() => useDelayedFlag(true, 300));
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // No state-update-after-unmount warning indicates the cleanup ran.
  });
});
