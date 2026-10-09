import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { strings } from '@/strings/en';

/**
 * Locks page scrolling while any dialog is open: `overflow: hidden` on the root, nothing else.
 * The page always reserves the scrollbar's space (`scrollbar-gutter: stable` in index.css), so
 * hiding it moves nothing.
 *
 * This replaces Radix's Dialog.Overlay, whose scroll lock (react-remove-scroll) inserted a
 * stylesheet and changed the page's margins on every open and close. That restyled and
 * re-laid-out the whole page right as the dialog started to slide in, the stutter people saw.
 * Focus trapping, outside-click closing and hiding the page from screen readers come from
 * Dialog.Content and are unaffected.
 */
let scrollLocks = 0;
function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (scrollLocks++ === 0) document.documentElement.style.overflow = 'hidden';
    return () => {
      if (--scrollLocks === 0) document.documentElement.style.overflow = '';
    };
  }, [locked]);
}

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Escape with a dropdown list open closes only the list (as with a native select), not the dialog. */
function ignoreEscapeForOpenSelect(event: KeyboardEvent) {
  if ((event.target as Element | null)?.closest?.('[role="combobox"][aria-expanded="true"]')) event.preventDefault();
}

/** Fields that bring up an on-screen keyboard when focused. */
const TYPING_FIELD = 'input:not([type=button],[type=checkbox],[type=radio],[type=submit],[type=reset]), textarea';

/**
 * Focus the first element marked data-autofocus (e.g. the amount field) instead of the close
 * button, without scrolling (the dialog is still sliding in).
 *
 * On touch screens a text field isn't focused automatically: that would open the keyboard right
 * as the sheet arrives, resizing the page under it (owner report, 2026-10-10: flicker while the
 * sheet popped up). There the dialog itself takes focus (screen readers announce it), and the
 * keyboard opens when the person taps a field. The page then shrinks above the keyboard
 * (interactive-widget=resizes-content in index.html), so the sheet sits above it and the browser
 * keeps the field in view: no script runs while the keyboard moves.
 *
 * Focus moves on the next frame rather than while the dialog mounts: focusing forces a style and
 * layout pass, which then runs a second time for the frame. Done in the frame, it runs once.
 */
function focusMarkedElement(event: Event) {
  const content = event.currentTarget as HTMLElement | null;
  const target = content?.querySelector<HTMLElement>('[data-autofocus]');
  if (!content || !target) return;
  event.preventDefault();

  requestAnimationFrame(() => {
    if (!content.isConnected) return;
    const touchTyping = target.matches(TYPING_FIELD) && window.matchMedia('(pointer: coarse)').matches;
    (touchTyping ? content : target).focus({ preventScroll: true });
  });
}

/**
 * Bottom sheet on phones, centered dialog on wide screens: one component, switched purely by the
 * `wide:` breakpoint. Radix handles the focus trap, Escape to close and returning focus.
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, children }: ResponsiveDialogProps) {
  useScrollLock(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* The dimmed backdrop (see useScrollLock for why it isn't Dialog.Overlay). Pointer
            events on, so a tap here closes the dialog and never reaches the page; touch-none,
            so a drag here can't scroll anything. */}
        <div
          aria-hidden="true"
          data-state={open ? 'open' : 'closed'}
          className="pointer-events-auto fixed inset-0 z-40 touch-none bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        />
        <Dialog.Content
          onOpenAutoFocus={focusMarkedElement}
          onEscapeKeyDown={ignoreEscapeForOpenSelect}
          className={
            // Opaque surface (no blur) and clipped to its corners: see surface-sheet in index.css.
            // Fixed to the bottom of the page, which on phones ends above the on-screen keyboard.
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
          <div className="scrollbar-subtle min-h-0 overflow-y-auto overscroll-contain bg-surface px-5 pt-4 pb-5 wide:mr-1 wide:mb-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
