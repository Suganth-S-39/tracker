import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';

/** Shown while offline. The app is online-only: writes are disabled, never queued (spec section 5). */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite">
      {online ? null : (
        <p className="flex items-center justify-center gap-2 bg-fg px-4 py-2 pt-safe text-center text-sm font-medium text-bg">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          {strings.offline.banner}
        </p>
      )}
    </div>
  );
}
