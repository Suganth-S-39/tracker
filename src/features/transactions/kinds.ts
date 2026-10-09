import type { TransactionType } from '@/features/categories/api';

export type { TransactionType };

/** Every kind of transaction, in display order. */
export const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income', 'savings', 'investment'];

/**
 * The text color for an amount of each kind. Always paired with a non-color cue: a +/- sign, and
 * for savings and investments a label.
 */
export const AMOUNT_TEXT: Readonly<Record<TransactionType, string>> = {
  expense: 'text-expense-strong',
  income: 'text-income-strong',
  savings: 'text-savings-strong',
  investment: 'text-investment-strong',
};
