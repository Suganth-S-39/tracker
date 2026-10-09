import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { strings } from '@/strings/en';

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Fields that bring up an on-screen keyboard when focused. */
const TYPING_FIELD = 'input:not([type=button],[type=checkbox],[type=radio],[type=submit],[type=reset]), textarea';

/**
 * Focus the first element marked data-autofocus (e.g. the amount field) instead of the close
 * button, without scrolling (the dialog is still sliding in).
 *
 * On touch screens, focusing a text field opens the keyboard, and a keyboard opening during the
 * slide-in makes both animations stutter. There the dialog itself takes focus first (screen
 * readers announce it), and the field once the dialog has settled. Android then opens the
 * keyboard; iOS opens it when the field is tapped.
 */
function focusMarkedElement(event: Event) {
  const content = event.currentTarget as HTMLElement | null;
  const target = content?.querySelector<HTMLElement>('[data-autofocus]');
  if (!content || !target) return;
  event.preventDefault();

  if (!target.matches(TYPING_FIELD) || !window.matchMedia('(pointer: coarse)').matches) {
    target.focus({ preventScroll: true });
    return;
  }
  content.focus({ preventScroll: true });
  // Unless the person has already moved focus themselves.
  const focusField = () => {
    if (document.activeElement === content) target.focus({ preventScroll: true });
  };
  content.addEventListener('animationend', focusField, { once: true });
  window.setTimeout(focusField, 400); // in case no animation runs
}

/**
 * Bottom sheet on phones, centered dialog on wide screens: one component, switched purely by the
 * `wide:` breakpoint. Radix handles the focus trap, Escape to close and returning focus.
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, children }: ResponsiveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          onOpenAutoFocus={focusMarkedElement}
          className={
            // Opaque surface (no blur) and clipped to its corners: see surface-sheet in index.css.
            'surface-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-card pb-safe ' +
            'data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in ' +
            'wide:inset-x-auto wide:bottom-auto wide:left-1/2 wide:top-1/2 wide:w-[calc(100%-2rem)] wide:max-w-lg ' +
            'wide:-translate-x-1/2 wide:-translate-y-1/2 wide:rounded-card wide:pb-0 ' +
            'wide:data-[state=closed]:animate-dialog-out wide:data-[state=open]:animate-dialog-in'
          }
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-divider wide:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 wide:pt-5">
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-fg-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mr-1.5 grid size-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-hover"
              aria-label={strings.common.close}
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          {/* min-h-0 lets this flex child shrink, so long forms scroll inside the dialog. Its own
              opaque background lets the browser scroll it as a cached layer (smooth at any zoom). */}
          <div className="min-h-0 overflow-y-auto overscroll-contain bg-surface px-5 pt-4 pb-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
