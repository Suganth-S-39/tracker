// Budget usage for display (spec section 9). Pure TypeScript, no React. The amounts come from
// the database (public.budget_status); only the percentage and warning state are worked out here.

/** Open item 10: warning thresholds, as whole percentages of the budget. */
export const NEAR_LIMIT_PERCENT = 80;
export const OVER_LIMIT_PERCENT = 100;

export type BudgetState = 'ok' | 'near' | 'over';

export type BudgetUsage = {
  /** Whole percent spent, rounded down (can exceed 100). */
  percent: number;
  /** Width of the progress bar, 0-100. */
  barPercent: number;
  state: BudgetState;
  /** Budget minus spending, in minor units. Negative when over. */
  remainingMinor: number;
};

/** Integer math throughout, so large amounts never lose precision. */
export function budgetUsage(spentMinor: number, budgetMinor: number): BudgetUsage {
  if (!Number.isSafeInteger(spentMinor) || !Number.isSafeInteger(budgetMinor) || budgetMinor <= 0) {
    throw new RangeError(`Invalid budget usage: ${spentMinor} of ${budgetMinor}`);
  }
  const spent = BigInt(Math.max(0, spentMinor));
  const budget = BigInt(budgetMinor);
  const percent = Number((spent * 100n) / budget);
  const state: BudgetState =
    spent * 100n >= budget * BigInt(OVER_LIMIT_PERCENT)
      ? 'over'
      : spent * 100n >= budget * BigInt(NEAR_LIMIT_PERCENT)
        ? 'near'
        : 'ok';
  return {
    percent,
    barPercent: Math.min(100, percent),
    state,
    remainingMinor: budgetMinor - Math.max(0, spentMinor),
  };
}
