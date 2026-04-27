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

    const flat: Record<string, string> = {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      background: theme.colors.background,
      foreground: theme.colors.foreground,
      card: theme.colors.card,
      "card-secondary": theme.colors.cardSecondary,
      muted: theme.colors.muted,
      "muted-foreground": theme.colors.mutedForeground,
      border: theme.colors.border,
      "syntax-comment": theme.colors.syntax.comment,
      "syntax-key": theme.colors.syntax.key,
      "syntax-string": theme.colors.syntax.string,
      "syntax-number": theme.colors.syntax.number,
      "syntax-keyword": theme.colors.syntax.keyword,
      "syntax-punct": theme.colors.syntax.punct,
    };
    for (const [name, value] of Object.entries(flat)) {
      root.style.setProperty(`--${name}-hsl`, value);
    }
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
