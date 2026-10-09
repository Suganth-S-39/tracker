import { createContext, useContext } from 'react';
import type { AccentTheme, ResolvedTheme, ThemeMode } from './theme';

export type ThemeContextValue = {
  mode: ThemeMode;
  accent: AccentTheme;
  resolved: ResolvedTheme;
  setPreferences: (next: Partial<{ mode: ThemeMode; accent: AccentTheme }>) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
