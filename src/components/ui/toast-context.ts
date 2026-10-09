import { createContext, useContext } from 'react';

export type ToastInput = {
  message: string;
  action?: { label: string; onAction: () => void };
};

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Shows a short message at the bottom of the screen, optionally with one action (e.g. Undo). */
export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
