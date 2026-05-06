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
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type ResolvedThemeId } from "./themes";

export type ThemeMode = "light" | "dark" | "auto";

interface ThemeContextValue {
  /** The user's stored preference. */
  mode: ThemeMode;
  /** The resolved theme actually applied to the document. */
  resolved: ResolvedThemeId;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "td-color-theme";
const VALID_MODES: ThemeMode[] = ["light", "dark", "auto"];

function isValidMode(value: string | null): value is ThemeMode {
  return VALID_MODES.includes(value as ThemeMode);
}

function getSystemTheme(): ResolvedThemeId {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isValidMode(stored) ? stored : "auto";
    } catch {
      return "auto";
    }
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedThemeId>(getSystemTheme);

  const resolved: ResolvedThemeId = mode === "auto" ? systemTheme : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable (private mode quota, etc.)
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "auto") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const setMode = (next: ThemeMode) => setModeState(next);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
