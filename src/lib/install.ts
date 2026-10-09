// "Install app" support. Chromium browsers fire `beforeinstallprompt` once, early, so this module
// is imported from main.tsx to catch it before any screen that offers installing has loaded.
// Safari has no prompt; Settings shows Add-to-Home-Screen instructions there instead.

import { useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // show our own button instead of the browser's mini-infobar
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the browser offered to install the app, and a function to show its prompt. */
export function useInstallPrompt(): { available: boolean; install: () => Promise<void> } {
  const available = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  return {
    available,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    },
  };
}

/** Running as an installed app (home screen / dock). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad, where installing is done from Safari's Share menu. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
