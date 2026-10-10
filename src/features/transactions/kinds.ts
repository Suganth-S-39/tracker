import type { TransactionType } from '@/features/categories/api';

export type { TransactionType };

/** The kinds people add in the Add form (and make categories for), in display order. */
export type EntryKind = Exclude<TransactionType, 'withdrawal'>;
export const ENTRY_KINDS: readonly EntryKind[] = ['expense', 'income', 'savings', 'investment'];

/**
 * Every kind of transaction, in display order: the entry kinds plus money taken back out of a
 * savings goal ('withdrawal'), which only the goal page creates.
 */
export const TRANSACTION_TYPES: readonly TransactionType[] = [...ENTRY_KINDS, 'withdrawal'];

/**
 * The text color for an amount of each kind. Always paired with a non-color cue: a +/- sign, and
 * for savings, investments and goal withdrawals a label.
 */
export const AMOUNT_TEXT: Readonly<Record<TransactionType, string>> = {
  expense: 'text-expense-strong',
  income: 'text-income-strong',
  savings: 'text-savings-strong',
  investment: 'text-investment-strong',
  withdrawal: 'text-savings-strong',
};

/**
 * Rows the goal page owns: money taken out of a goal, and the purchase recorded when it was
 * bought. They open their goal instead of the edit form and aren't deleted from the lists.
 */
export function isGoalManaged(transaction: { type: TransactionType; goal_id: string | null }): boolean {
  return transaction.type === 'withdrawal' || (transaction.type === 'expense' && transaction.goal_id !== null);
}
