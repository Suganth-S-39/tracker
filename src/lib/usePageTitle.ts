import { useEffect } from 'react';
import { strings } from '@/strings/en';

/** Sets the browser tab / window title ("Budgets · Tracker"); the route announcer reads it. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${strings.app.name}` : strings.app.name;
  }, [title]);
}
