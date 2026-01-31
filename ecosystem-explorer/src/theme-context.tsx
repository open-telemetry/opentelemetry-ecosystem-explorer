import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {type ThemeId, themes, DEFAULT_THEME } from './themes';

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

    // Apply theme colors to CSS variables
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-foreground', theme.colors.foreground);
    root.style.setProperty('--color-card', theme.colors.card);
    root.style.setProperty('--color-card-secondary', theme.colors.cardSecondary);
    root.style.setProperty('--color-muted-foreground', theme.colors.mutedForeground);
    root.style.setProperty('--color-border', theme.colors.border);

    root.setAttribute('data-theme', themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
