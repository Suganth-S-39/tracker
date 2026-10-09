import { strings } from '@/strings/en';
import { Button } from './Button';
import { ResponsiveDialog } from './ResponsiveDialog';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
};

/** Asks before a destructive action that can't be undone (e.g. deleting an IOU). */
export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, pending = false }: ConfirmDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} description={body}>
      <div className="flex flex-col-reverse gap-2 wide:flex-row wide:justify-end">
        <Button variant="secondary" onClick={() => onOpenChange(false)} data-autofocus>
          {strings.common.cancel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
