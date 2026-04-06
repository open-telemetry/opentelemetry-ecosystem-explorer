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
import { type ThemeId, themes, DEFAULT_THEME } from "./themes";

interface ThemeContextType {
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const theme = themes[themeId];
    const root = document.documentElement;

    // Apply theme colors to CSS variables (HSL triplets)
    root.style.setProperty("--primary-hsl", theme.colors.primary);
    root.style.setProperty("--secondary-hsl", theme.colors.secondary);
    root.style.setProperty("--background-hsl", theme.colors.background);
    root.style.setProperty("--foreground-hsl", theme.colors.foreground);
    root.style.setProperty("--card-hsl", theme.colors.card);
    root.style.setProperty("--card-secondary-hsl", theme.colors.cardSecondary);
    root.style.setProperty("--muted-hsl", theme.colors.muted);
    root.style.setProperty("--muted-foreground-hsl", theme.colors.mutedForeground);
    root.style.setProperty("--border-hsl", theme.colors.border);

    root.setAttribute("data-theme", themeId);
  }, [themeId]);

  return <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
