import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { strings } from '@/strings/en';
import { ToastContext, type ToastInput } from './toast-context';

const DURATION_MS = 6000;

type Toast = ToastInput & { id: number };

/**
 * One toast at a time, above the bottom bar on phones. Announced politely to screen readers.
 * The timer pauses while the pointer or keyboard focus is on the toast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(1);

  const show = useCallback((input: ToastInput) => {
    setToast({ ...input, id: nextId.current++ });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 wide:bottom-6 wide:pl-60"
        role="status"
        aria-live="polite"
      >
        {toast ? (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md animate-fade-in items-center gap-3 rounded-control bg-fg py-2 pr-2 pl-4 text-sm font-medium text-bg shadow-raised"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="h-9 rounded-[0.625rem] px-3 font-bold underline-offset-2 hover:underline"
                onClick={() => {
                  toast.action?.onAction();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={strings.common.dismiss}
              className="grid size-9 place-items-center rounded-[0.625rem] opacity-80 hover:opacity-100"
              onClick={() => setToast(null)}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}
