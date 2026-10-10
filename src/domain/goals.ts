// Savings goals for display (owner request, 2026-10-10). Pure TypeScript, no React. The amounts
// come from the database (public.goal_list); only the percentage and the two hints, "save this
// much a week" and "at your recent pace", are worked out here.

import { addDays, daysBetween, type IsoDate } from './dates';

/** Matches goal_list's pace window in SQL (the 8 weeks up to today). */
export const PACE_WINDOW_DAYS = 56;
/** A pace from less than this is spread over this many days, so one early deposit isn't a trend. */
const MIN_PACE_DAYS = 7;

export type GoalProgress = {
  /** Whole percent saved, rounded down and at most 100 (so 100% means it's all there). */
  percent: number;
  /** 0-1, for the progress bar and ring. */
  fraction: number;
  /** Still to save, in minor units (0 once reached). */
  remainingMinor: number;
  reached: boolean;
};

function assertMinor(...values: number[]) {
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new RangeError(`Not a safe integer amount: ${value}`);
  }
}

/** Integer math, so large amounts never lose precision. */
export function goalProgress(savedMinor: number, targetMinor: number): GoalProgress {
  assertMinor(savedMinor, targetMinor);
  if (targetMinor <= 0) throw new RangeError(`Invalid goal target: ${targetMinor}`);
  const saved = BigInt(Math.max(0, savedMinor));
  const target = BigInt(targetMinor);
  const reached = saved >= target;
  return {
    percent: reached ? 100 : Number((saved * 100n) / target),
    fraction: reached ? 1 : Number((saved * 10_000n) / target) / 10_000,
    remainingMinor: reached ? 0 : Number(target - saved),
    reached,
  };
}

export type GoalPlan =
  /** Nothing left to save. */
  | { kind: 'reached' }
  /** Save this much a week (rounded up to a whole unit of the currency) to make the date. */
  | { kind: 'weekly'; perWeekMinor: number; weeks: number }
  /** The date has passed with money still to save. */
  | { kind: 'late' }
  /** No date set. */
  | { kind: 'none' };

/** What it takes to reach the goal by its date, from today. */
export function goalPlan(input: {
  savedMinor: number;
  targetMinor: number;
  targetDate: IsoDate | null;
  today: IsoDate;
  /** The currency's minor-unit exponent, to round the weekly amount up to whole units. */
  exponent: number;
}): GoalPlan {
  const { remainingMinor, reached } = goalProgress(input.savedMinor, input.targetMinor);
  if (reached) return { kind: 'reached' };
  if (!input.targetDate) return { kind: 'none' };
  const days = daysBetween(input.today, input.targetDate);
  if (days < 0) return { kind: 'late' };

  const weeks = Math.max(1, Math.ceil(days / 7));
  const unit = 10n ** BigInt(input.exponent);
  const remaining = BigInt(remainingMinor);
  const perWeek = (remaining + BigInt(weeks) - 1n) / BigInt(weeks);
  return { kind: 'weekly', perWeekMinor: Number(((perWeek + unit - 1n) / unit) * unit), weeks };
}

/**
 * Weeks to go at the recent pace: what went in minus what came out over the last 8 weeks (or
 * since the first saving, if that's more recent). Null when there's no pace to go on (nothing
 * saved lately, or more taken out than put in) or nothing left to save. An estimate, so plain
 * floating point is fine here.
 */
export function goalPaceWeeks(input: {
  remainingMinor: number;
  recentNetMinor: number;
  firstAddedOn: IsoDate | null;
  today: IsoDate;
}): number | null {
  const { remainingMinor, recentNetMinor, firstAddedOn, today } = input;
  if (remainingMinor <= 0 || recentNetMinor <= 0 || !firstAddedOn) return null;
  const windowStart = addDays(today, -(PACE_WINDOW_DAYS - 1));
  const from = firstAddedOn > windowStart ? firstAddedOn : windowStart;
  const days = Math.max(MIN_PACE_DAYS, daysBetween(from, today) + 1);
  const perWeek = (recentNetMinor / days) * 7;
  return Math.max(1, Math.ceil(remainingMinor / perWeek));
}

export type Duration = { unit: 'weeks' | 'months' | 'years'; count: number };

/** A number of weeks in words-friendly units: weeks up to 8, then months, then years from 2. */
export function weeksAsDuration(weeks: number): Duration {
  if (weeks <= 8) return { unit: 'weeks', count: weeks };
  const months = Math.round((weeks * 7) / 30.44);
  if (months < 24) return { unit: 'months', count: months };
  return { unit: 'years', count: Math.round(months / 12) };
}
