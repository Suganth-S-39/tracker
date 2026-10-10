import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { strings } from '@/strings/en';

/**
 * Back, for the installed app (which has no browser back button). Opened from inside the app, it
 * returns to where the person was; opened directly (a reload or a link), it goes to `fallback`.
 */
export function BackButton({ fallback = '/', label = strings.common.back }: { fallback?: string; label?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => void (location.key === 'default' ? navigate(fallback) : navigate(-1));
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-2 inline-flex h-10 items-center gap-1 rounded-control px-2 text-sm font-semibold text-fg-muted hover:text-fg"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
