import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@/lib/hooks';
import { readStoredPreferences, resolveTheme, writeStoredPreferences } from './theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';

function localStorageOrUndefined(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Applies theme mode and accent to <html>. The inline script in index.html does the same before
 * first paint; this keeps it in sync afterwards (system changes, user choices).
 * The profile is the source of truth across devices; see ThemeProfileSync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => readStoredPreferences(localStorageOrUndefined()));
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolved = resolveTheme(prefs.mode, systemPrefersDark);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.accent = prefs.accent;
    // Match the browser / installed-app chrome to the page background.
    const background = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }, [resolved, prefs.accent]);

  const setPreferences = useCallback<ThemeContextValue['setPreferences']>((next) => {
    setPrefs((current) => {
      const merged = { ...current, ...next };
      if (merged.mode === current.mode && merged.accent === current.accent) return current;
      writeStoredPreferences(localStorageOrUndefined(), merged);
      return merged;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode: prefs.mode, accent: prefs.accent, resolved, setPreferences }),
    [prefs.mode, prefs.accent, resolved, setPreferences],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
