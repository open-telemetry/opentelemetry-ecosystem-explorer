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
import { render, renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-context";
import { DEFAULT_THEME } from "./themes";

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

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("applies default resolved theme (dark) to data-theme when no stored value", () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
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
