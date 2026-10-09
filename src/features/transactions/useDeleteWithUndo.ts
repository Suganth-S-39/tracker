import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast-context';
import { errorMessage } from '@/lib/errors';
import { strings } from '@/strings/en';
import { useDeleteTransaction, useRestoreTransaction, type Transaction } from './api';

/** Soft-deletes a transaction and offers Undo (spec section 8: swipe or delete, then undo). */
export function useDeleteWithUndo(): (transaction: Pick<Transaction, 'id' | 'type'>) => void {
  const { mutate: remove } = useDeleteTransaction();
  const { mutate: restore } = useRestoreTransaction();
  const toast = useToast();

  return useCallback(
    (transaction) => {
      remove(transaction.id, {
        onSuccess: () =>
          toast({
            message: strings.transactions.deleted[transaction.type],
            action: { label: strings.transactions.undo, onAction: () => restore(transaction.id) },
          }),
        onError: (error) => toast({ message: errorMessage(error) }),
      });
    },
    [remove, restore, toast],
  );
}
