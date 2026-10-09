// IOU display logic (spec section 8). Pure TypeScript, no React. Balances themselves come from
// the database (public.iou_balances); this only decides rates for previews and labels.

import type { IsoDate } from './dates';

/**
 * The rate for a repayment's linked transaction: repayment currency -> base currency
 * (DECISIONS.md). If the repayment is in the base currency it's 1. If the IOU is in the base
 * currency, the repayment -> IOU rate the user saw (and may have edited) is the same thing, so it
 * is reused. Otherwise the latest known rate is used (not editable in v1).
 */
export function repaymentBaseRate(input: {
  repaymentCurrency: string;
  iouCurrency: string;
  baseCurrency: string;
  /** Repayment -> IOU currency rate in the form (null while unknown or invalid). */
  iouRate: string | null;
  /** Latest repayment -> base rate from the database (null if none). */
  latestToBase: string | null;
}): string | null {
  if (input.repaymentCurrency === input.baseCurrency) return '1';
  if (input.iouCurrency === input.baseCurrency) return input.iouRate;
  return input.latestToBase;
}

/** An open IOU whose due date has passed. */
export function isOverdue(dueDate: IsoDate | null, remainingMinor: number, today: IsoDate): boolean {
  return dueDate !== null && remainingMinor > 0 && dueDate < today;
}

/**
 * What a repayment may still cover, in the IOU's currency: the remaining balance, plus the
 * repayment being edited (its own amount is already counted as repaid).
 */
export function repayableMinor(remainingMinor: number, editingRepaymentMinor = 0): number {
  return remainingMinor + editingRepaymentMinor;
}
