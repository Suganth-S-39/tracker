import { createContext, useContext } from 'react';
import type { Transaction } from './api';
import type { TransactionType } from './kinds';

export type EditorKind = TransactionType | 'iou';

export type TransactionEditor = {
  /** Opens the Add form, optionally on a given tab (the IOU page opens it on IOU). */
  openCreate: (kind?: EditorKind) => void;
  openEdit: (transaction: Transaction) => void;
};

export const TransactionEditorContext = createContext<TransactionEditor | null>(null);

/** Opens the Add form (bottom sheet on phones, dialog on desktop) for a new or existing transaction. */
export function useTransactionEditor(): TransactionEditor {
  const value = useContext(TransactionEditorContext);
  if (!value) throw new Error('useTransactionEditor must be used inside <TransactionEditorProvider>');
  return value;
}
