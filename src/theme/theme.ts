// Theme preferences: pure helpers with no React dependency.
// The inline script in index.html applies the same keys before first paint; keep them in sync.

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export const ACCENT_THEMES = ['graphite', 'green', 'teal', 'gold', 'rose'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type AccentTheme = (typeof ACCENT_THEMES)[number];
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'system';
export const DEFAULT_ACCENT: AccentTheme = 'graphite';

export const STORAGE_KEYS = {
  mode: 'tracker.theme-mode',
  accent: 'tracker.accent-theme',
} as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function isAccentTheme(value: unknown): value is AccentTheme {
  return typeof value === 'string' && (ACCENT_THEMES as readonly string[]).includes(value);
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** Storage can throw (private mode, blocked site data); treat that as "nothing saved". */
export function readStoredPreferences(storage: Pick<Storage, 'getItem'> | undefined): {
  mode: ThemeMode;
  accent: AccentTheme;
} {
  let mode: unknown;
  let accent: unknown;
  try {
    mode = storage?.getItem(STORAGE_KEYS.mode);
    accent = storage?.getItem(STORAGE_KEYS.accent);
  } catch {
    // ignore
  }
  return {
    mode: isThemeMode(mode) ? mode : DEFAULT_THEME_MODE,
    accent: isAccentTheme(accent) ? accent : DEFAULT_ACCENT,
  };
}

export function writeStoredPreferences(
  storage: Pick<Storage, 'setItem'> | undefined,
  prefs: { mode: ThemeMode; accent: AccentTheme },
): void {
  try {
    storage?.setItem(STORAGE_KEYS.mode, prefs.mode);
    storage?.setItem(STORAGE_KEYS.accent, prefs.accent);
  } catch {
    // ignore: the theme still applies for this session
  }
}
