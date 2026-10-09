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

/** Focus the first element marked data-autofocus (e.g. the amount field) instead of the close button. */
function focusMarkedElement(event: Event) {
  const target = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-autofocus]');
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

/**
 * Bottom sheet on phones, centered dialog on wide screens: one component, switched purely by the
 * `wide:` breakpoint. Radix handles the focus trap, Escape to close and returning focus.
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, children }: ResponsiveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          onOpenAutoFocus={focusMarkedElement}
          className={
            'glass-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-card pb-safe ' +
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
          {/* min-h-0 lets this flex child shrink, so long forms scroll inside the dialog. */}
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
