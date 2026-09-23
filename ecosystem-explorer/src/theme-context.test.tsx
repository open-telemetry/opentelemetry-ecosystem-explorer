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
import { cleanup, render, renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/theme-context";

function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mql = {
    matches: prefersDark,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    },
    fire: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((fn) => fn({ matches }));
    },
  };
  vi.stubGlobal("matchMedia", () => mql);
  return mql;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("follows the dark OS preference when no mode is stored", () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("reads stored light preference on mount", () => {
    mockMatchMedia(false);
    localStorage.setItem("td-color-theme", "light");
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("reads stored dark preference on mount", () => {
    mockMatchMedia(false);
    localStorage.setItem("td-color-theme", "dark");
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists mode to localStorage when setMode is called", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setMode("light"));
    expect(localStorage.getItem("td-color-theme")).toBe("light");
  });

  it("auto mode with prefers-dark resolves to dark", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setMode("auto"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("auto mode with prefers-light resolves to light", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setMode("auto"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("auto mode responds to matchMedia change without updating localStorage", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setMode("auto"));
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => mql.fire(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    expect(localStorage.getItem("td-color-theme")).toBe("auto");
  });

  it.each(["light", "dark"] as const)("keeps explicit %s selected across OS changes", (mode) => {
    const mql = mockMatchMedia(false);
    localStorage.setItem("td-color-theme", mode);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    for (const prefersDark of [true, false]) {
      act(() => mql.fire(prefersDark));
      expect(result.current.mode).toBe(mode);
      expect(result.current.resolved).toBe(mode);
      expect(document.documentElement.dataset.theme).toBe(mode);
      expect(localStorage.getItem("td-color-theme")).toBe(mode);
    }
  });

  it("switches back to the current OS theme when Auto is selected", () => {
    const mql = mockMatchMedia(false);
    localStorage.setItem("td-color-theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => mql.fire(true));
    act(() => result.current.setMode("auto"));
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("td-color-theme")).toBe("auto");

    act(() => mql.fire(false));
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("td-color-theme")).toBe("auto");
  });

  it("restores a selected mode on remount", () => {
    mockMatchMedia(false);
    const first = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => first.result.current.setMode("dark"));
    first.unmount();

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to Auto for an invalid stored mode", () => {
    mockMatchMedia(false);
    localStorage.setItem("td-color-theme", "invalid");
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe("auto");
    expect(result.current.resolved).toBe("light");
    expect(localStorage.getItem("td-color-theme")).toBe("auto");
  });

  it("can select a theme when persistence is unavailable", () => {
    mockMatchMedia(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe("auto");
    expect(result.current.resolved).toBe("light");
    act(() => result.current.setMode("dark"));
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("useTheme", () => {
  it("throws when used outside ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
  });

  it("returns mode, resolved, and setMode", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe("auto");
    expect(result.current.resolved).toBe("dark");
    expect(typeof result.current.setMode).toBe("function");
  });
});
