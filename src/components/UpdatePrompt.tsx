import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';
import { strings } from '@/strings/en';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * "Update available" (spec section 9): when a new version has been deployed, ask instead of
 * reloading under the user. Long-open sessions check for a new version every hour.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div role="alert" className="glass-strong pointer-events-auto flex max-w-md animate-fade-in items-center gap-3 rounded-card py-2 pr-2 pl-4">
        <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-accent-strong" />
        <p className="flex-1 text-sm font-medium">{strings.pwa.updateAvailable}</p>
        <Button variant="ghost" className="h-9" onClick={() => setNeedRefresh(false)}>
          {strings.pwa.later}
        </Button>
        <Button className="h-9" onClick={() => void updateServiceWorker(true)}>
          {strings.pwa.update}
        </Button>
      </div>
    </div>
  );
}
