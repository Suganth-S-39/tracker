import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { strings } from '@/strings/en';

/**
 * Client-side navigation is silent to screen readers. After each route change (not the first
 * load), announce the new page and move focus to the start of the main content, as a full page
 * load would.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Let the new page set its title first.
    const timer = window.setTimeout(() => {
      const title = document.title.split(' · ')[0] ?? document.title;
      setMessage(strings.a11y.navigatedTo(title));
      // Unless the person has already moved into the new page (don't pull focus from under them).
      const main = document.getElementById('main');
      if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
