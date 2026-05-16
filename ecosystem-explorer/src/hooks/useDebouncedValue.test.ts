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
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 250));
    expect(result.current).toBe("initial");
  });

  it("debounces value updates", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: "a" },
    });

    expect(result.current).toBe("a");

    act(() => {
      rerender({ value: "ab" });
    });

    // Before delay, should still be 'a'
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("a");

    // After delay, should be 'ab'
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("ab");
  });

  it("cancels pending debounce on unmount", () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: "a" },
    });

    act(() => {
      rerender({ value: "abc" });
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Nothing to assert really, but confirming no errors/state updates after unmount
  });

  it("respects custom delay", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: "a", delay: 50 },
    });

    act(() => {
      rerender({ value: "longer", delay: 50 });
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe("longer");
  });
});
