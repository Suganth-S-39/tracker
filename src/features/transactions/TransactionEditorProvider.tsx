import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { strings } from '@/strings/en';
import type { Transaction } from './api';
import { TransactionEditorContext, type EditorKind, type TransactionEditor } from './editor-context';
import { isGoalManaged } from './kinds';
import { TransactionForm } from './TransactionForm';

type Target = { transaction?: Transaction; kind?: EditorKind; goalId?: string; key: number };

const noop = () => {};

/** Runs `fn` when the browser is idle (Safari has no requestIdleCallback). Returns a cancel. */
function whenIdle(fn: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, timeout / 2);
  return () => clearTimeout(id);
}

/**
 * Renders the Add form once, hidden, while the app is idle after loading, then removes it. The
 * first time code runs it's much slower than later (the browser compiles it then), and the first
 * open also fetched the payee suggestions mid-slide. Warmed up, the first tap on + opens as
 * smoothly as later ones (phone CPU: 20% of frames dropped on a first open, 9% on later ones).
 */
function useWarmUp(ready: boolean): boolean {
  const [phase, setPhase] = useState<'waiting' | 'warming' | 'done'>('waiting');
  useEffect(() => {
    if (!ready || phase !== 'waiting') return;
    return whenIdle(() => setPhase('warming'), 3000);
  }, [ready, phase]);
  useEffect(() => {
    if (phase !== 'warming') return;
    return whenIdle(() => setPhase('done'), 1000);
  }, [phase]);
  return phase === 'warming';
}

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
      openCreate: (kind, options) => {
        setTarget((t) => ({ ...(kind ? { kind } : {}), ...(options?.goalId ? { goalId: options.goalId } : {}), key: t.key + 1 }));
        setOpen(true);
      },
      openEdit: (transaction) => {
        // IOU-linked transactions are edited through their IOU; money taken out of a goal and a
        // goal's purchase, on the goal's page.
        if (transaction.iou_id) {
          void navigate(`/ious/${transaction.iou_id}`);
          return;
        }
        if (isGoalManaged(transaction) && transaction.goal_id) {
          void navigate(`/goals/${transaction.goal_id}`);
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
  const warming = useWarmUp(money !== null && categories.data !== undefined);

  return (
    <TransactionEditorContext value={editor}>
      {children}
      {warming && money && categories.data && !open ? (
        // Hidden: not displayed, not in the accessibility tree, nothing laid out or painted.
        <div hidden>
          <TransactionForm money={money} categories={categories.data} onClose={noop} />
        </div>
      ) : null}
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
            initialGoalId={target.goalId}
            onClose={close}
          />
        )}
      </ResponsiveDialog>
    </TransactionEditorContext>
  );
}
