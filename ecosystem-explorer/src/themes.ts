/**
 * Theme System
 *
 * To change the active theme update DEFAULT_THEME to the desired theme id.
 */

export type ThemeId = 'dark-blue';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    card: string;
    cardSecondary: string;
    mutedForeground: string;
    border: string;
  };
}

export const themes: Record<ThemeId, Theme> = {
  'dark-blue': {
    id: 'dark-blue',
    name: 'OTel Vibrant',
    description: 'Dark blue theme',
    colors: {
      primary: '38 95% 52%',            // Vibrant orange
      secondary: '228 60% 55%',         // Brighter blue
      background: '232 38% 15%',        // Deep navy
      foreground: '210 45% 99%',        // Bright white with blue hint
      card: '232 35% 19%',              // Card background
      cardSecondary: '232 32% 23%',     // Hover state
      mutedForeground: '220 22% 65%',   // Muted text
      border: '232 28% 26%',            // Borders
    },
  },
};

export const DEFAULT_THEME: ThemeId = 'dark-blue';
