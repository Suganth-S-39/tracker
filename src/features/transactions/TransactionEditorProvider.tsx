import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { strings } from '@/strings/en';
import type { Transaction } from './api';
import { TransactionEditorContext, type EditorKind, type TransactionEditor } from './editor-context';
import { TransactionForm } from './TransactionForm';

type Target = { transaction?: Transaction; kind?: EditorKind; key: number };

/** Owns the single Add / Edit dialog and lets any screen open it. */
export function TransactionEditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the form doesn't vanish mid-animation; a new key resets the form.
  const [target, setTarget] = useState<Target>({ key: 0 });
  const navigate = useNavigate();
  const money = useMoney();
  const categories = useCategories();

  const editor = useMemo<TransactionEditor>(
    () => ({
      openCreate: (kind) => {
        setTarget((t) => ({ ...(kind ? { kind } : {}), key: t.key + 1 }));
        setOpen(true);
      },
      openEdit: (transaction) => {
        // IOU-linked transactions are edited through their IOU.
        if (transaction.iou_id) {
          void navigate(`/ious/${transaction.iou_id}`);
          return;
        }
        setTarget((t) => ({ transaction, key: t.key + 1 }));
        setOpen(true);
      },
    }),
    [navigate],
  );

  const close = useCallback(() => setOpen(false), []);
  const editingType = target.transaction?.type;

  return (
    <TransactionEditorContext value={editor}>
      {children}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={editingType ? strings.form.editTitle[editingType] : strings.form.addTitle}
        description={editingType ? strings.form.editDescription : strings.form.addDescription}
      >
        {(categories.isError && categories.data === undefined) ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
        ) : !money || !categories.data ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <TransactionForm
            key={target.key}
            money={money}
            categories={categories.data}
            transaction={target.transaction}
            initialKind={target.kind}
            onClose={close}
          />
        )}
      </ResponsiveDialog>
    </TransactionEditorContext>
  );
}
