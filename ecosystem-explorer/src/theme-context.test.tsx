import { render, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from './theme-context';
import { themes, DEFAULT_THEME } from './themes';

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Clear any theme attributes from previous tests
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies default theme CSS variables to document root', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const theme = themes[DEFAULT_THEME];
    const root = document.documentElement;

    expect(root.style.getPropertyValue('--color-primary')).toBe(theme.colors.primary);
    expect(root.style.getPropertyValue('--color-secondary')).toBe(theme.colors.secondary);
    expect(root.style.getPropertyValue('--color-background')).toBe(theme.colors.background);
    expect(root.style.getPropertyValue('--color-foreground')).toBe(theme.colors.foreground);
    expect(root.style.getPropertyValue('--color-card')).toBe(theme.colors.card);
    expect(root.style.getPropertyValue('--color-border')).toBe(theme.colors.border);
  });

  it('sets data-theme attribute on document root', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe(DEFAULT_THEME);
  });
});

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');
  });

  it('returns themeId and setThemeId', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.themeId).toBe(DEFAULT_THEME);
    expect(typeof result.current.setThemeId).toBe('function');
  });
});
