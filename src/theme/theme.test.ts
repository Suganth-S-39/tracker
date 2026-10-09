import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Enums } from '@/lib/supabase';
import {
  ACCENT_THEMES,
  DEFAULT_ACCENT,
  DEFAULT_THEME_MODE,
  STORAGE_KEYS,
  THEME_MODES,
  readStoredPreferences,
  resolveTheme,
  writeStoredPreferences,
  type AccentTheme,
  type ThemeMode,
} from './theme';

// Compile-time check that the TS lists match the database enums.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const modesMatch: Same<ThemeMode, Enums<'theme_mode'>> = true;
const accentsMatch: Same<AccentTheme, Enums<'accent_theme'>> = true;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('resolveTheme', () => {
  it('follows the system preference in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system preference when the user picked a mode', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('stored preferences', () => {
  it('defaults to system mode and the default accent', () => {
    expect(readStoredPreferences(memoryStorage())).toEqual({ mode: DEFAULT_THEME_MODE, accent: DEFAULT_ACCENT });
    expect(readStoredPreferences(undefined)).toEqual({ mode: DEFAULT_THEME_MODE, accent: DEFAULT_ACCENT });
  });

  it('round-trips every mode and accent', () => {
    for (const mode of THEME_MODES) {
      for (const accent of ACCENT_THEMES) {
        const storage = memoryStorage();
        writeStoredPreferences(storage, { mode, accent });
        expect(readStoredPreferences(storage)).toEqual({ mode, accent });
      }
    }
  });

  it('ignores invalid stored values', () => {
    const storage = memoryStorage({ [STORAGE_KEYS.mode]: 'sepia', [STORAGE_KEYS.accent]: 'violet' });
    expect(readStoredPreferences(storage)).toEqual({ mode: DEFAULT_THEME_MODE, accent: DEFAULT_ACCENT });
  });

  it('survives storage that throws (private mode, blocked site data)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredPreferences(throwing)).toEqual({ mode: DEFAULT_THEME_MODE, accent: DEFAULT_ACCENT });
    expect(() => writeStoredPreferences(throwing, { mode: 'dark', accent: 'teal' })).not.toThrow();
  });

});

describe('consistency', () => {
  it('matches the database enums', () => {
    expect(modesMatch && accentsMatch).toBe(true);
  });

  it('uses the same storage keys and defaults as the no-flash script in index.html', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain(`localStorage.getItem('${STORAGE_KEYS.mode}') || '${DEFAULT_THEME_MODE}'`);
    expect(html).toContain(`localStorage.getItem('${STORAGE_KEYS.accent}') || '${DEFAULT_ACCENT}'`);
  });
});
