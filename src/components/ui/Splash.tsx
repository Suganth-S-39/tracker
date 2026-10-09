import { strings } from '@/strings/en';
import { Spinner } from './Spinner';

/** Full-screen loading state while the session or profile loads. */
export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center text-accent-strong" role="status" aria-live="polite">
      <Spinner />
      <span className="sr-only">{strings.app.loading}</span>
    </div>
  );
}
