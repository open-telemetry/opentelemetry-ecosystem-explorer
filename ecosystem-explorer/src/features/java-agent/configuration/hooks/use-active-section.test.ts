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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useActiveSection } from "./use-active-section";

function makeSection(key: string, top: number): HTMLElement {
  const el = document.createElement("section");
  el.setAttribute("data-section-key", key);
  el.getBoundingClientRect = () => ({
    top,
    bottom: top + 200,
    left: 0,
    right: 800,
    width: 800,
    height: 200,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
  el.scrollIntoView = vi.fn();
  el.focus = vi.fn();
  document.body.appendChild(el);
  return el;
}

function setScrollGeometry({
  scrollY,
  innerHeight,
  scrollHeight,
}: {
  scrollY: number;
  innerHeight: number;
  scrollHeight: number;
}) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

function fireScroll() {
  window.dispatchEvent(new Event("scroll"));
  // Flush the rAF the hook schedules to coalesce scroll events.
  vi.advanceTimersByTime(20);
}

describe("useActiveSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setScrollGeometry({ scrollY: 0, innerHeight: 800, scrollHeight: 4000 });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("defaults activeKey to the first section so something is always highlighted", () => {
    makeSection("resource", 200);
    makeSection("tracer_provider", 800);
    const { result } = renderHook(() => useActiveSection(["resource", "tracer_provider"]));
    expect(result.current.activeKey).toBe("resource");
  });

  it("returns null when no section keys are provided", () => {
    const { result } = renderHook(() => useActiveSection([]));
    expect(result.current.activeKey).toBeNull();
  });

  it("picks the last section whose top has crossed the offset line", () => {
    makeSection("resource", -100);
    makeSection("tracer_provider", 50);
    makeSection("meter_provider", 600);
    const { result } = renderHook(() =>
      useActiveSection(["resource", "tracer_provider", "meter_provider"])
    );
    act(() => {
      fireScroll();
    });
    // resource (top -100) and tracer_provider (top 50) are both <= 81; the loop keeps
    // assigning, so the last qualifying one wins.
    expect(result.current.activeKey).toBe("tracer_provider");
  });

  it("pins the last section as active when scrolled to the very bottom", () => {
    makeSection("resource", -2000);
    makeSection("tracer_provider", -1500);
    makeSection("meter_provider", -1000);
    setScrollGeometry({ scrollY: 3200, innerHeight: 800, scrollHeight: 4000 });
    const { result } = renderHook(() =>
      useActiveSection(["resource", "tracer_provider", "meter_provider"])
    );
    act(() => {
      fireScroll();
    });
    expect(result.current.activeKey).toBe("meter_provider");
  });

  it("scrollToSection calls scrollIntoView, focuses, and sets activeKey immediately", () => {
    const a = makeSection("resource", 200);
    a.scrollIntoView = vi.fn();
    a.focus = vi.fn();
    const { result } = renderHook(() => useActiveSection(["resource", "tracer_provider"]));
    act(() => {
      result.current.scrollToSection("resource");
    });
    expect(a.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(a.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(result.current.activeKey).toBe("resource");
  });

  it("does not let intermediate scroll events override the activeKey during a programmatic scroll", () => {
    const a = makeSection("resource", 200);
    makeSection("tracer_provider", 800);
    a.scrollIntoView = vi.fn();
    a.focus = vi.fn();
    const { result } = renderHook(() => useActiveSection(["resource", "tracer_provider"]));
    act(() => {
      result.current.scrollToSection("tracer_provider");
    });
    expect(result.current.activeKey).toBe("tracer_provider");
    // Mid-flight scroll: viewport currently shows the first section's top crossing the line.
    a.getBoundingClientRect = () => ({
      top: 0,
      bottom: 200,
      left: 0,
      right: 800,
      width: 800,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    act(() => {
      fireScroll();
    });
    expect(result.current.activeKey).toBe("tracer_provider");
  });

  it("releases the click lock when scrollend fires", () => {
    makeSection("resource", 200);
    const b = makeSection("tracer_provider", 800);
    const { result } = renderHook(() => useActiveSection(["resource", "tracer_provider"]));
    act(() => {
      result.current.scrollToSection("resource");
    });
    act(() => {
      window.dispatchEvent(new Event("scrollend"));
    });
    // Now the listener is unlocked: a scroll moving tracer_provider above the line should win.
    b.getBoundingClientRect = () => ({
      top: 50,
      bottom: 250,
      left: 0,
      right: 800,
      width: 800,
      height: 200,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    });
    act(() => {
      fireScroll();
    });
    expect(result.current.activeKey).toBe("tracer_provider");
  });

  it("releases the click lock via setTimeout fallback when scrollend never fires", () => {
    makeSection("resource", 200);
    const b = makeSection("tracer_provider", 800);
    const { result } = renderHook(() => useActiveSection(["resource", "tracer_provider"]));
    act(() => {
      result.current.scrollToSection("resource");
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    b.getBoundingClientRect = () => ({
      top: 50,
      bottom: 250,
      left: 0,
      right: 800,
      width: 800,
      height: 200,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    });
    act(() => {
      fireScroll();
    });
    expect(result.current.activeKey).toBe("tracer_provider");
  });

  it("scrollToSection is a no-op for unknown keys", () => {
    const a = makeSection("resource", 200);
    a.scrollIntoView = vi.fn();
    const { result } = renderHook(() => useActiveSection(["resource"]));
    act(() => {
      result.current.scrollToSection("does-not-exist");
    });
    expect(a.scrollIntoView).not.toHaveBeenCalled();
  });

  it("removes the scroll listener on unmount", () => {
    makeSection("resource", 200);
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useActiveSection(["resource"]));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeSpy.mockRestore();
  });
});
