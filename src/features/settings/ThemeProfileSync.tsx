import { useEffect } from 'react';
import { useProfile } from '@/features/profile/api';
import { useTheme } from '@/theme/theme-context';

/**
 * The profile is the source of truth for theme preferences across devices. When it loads (or
 * changes elsewhere), apply it locally; ThemeProvider caches it in localStorage for the next
 * first paint.
 */
export function ThemeProfileSync() {
  const { data: profile } = useProfile();
  const { setPreferences } = useTheme();

  useEffect(() => {
    if (profile) setPreferences({ mode: profile.theme_mode, accent: profile.accent_theme });
  }, [profile, setPreferences]);

  return null;
}
