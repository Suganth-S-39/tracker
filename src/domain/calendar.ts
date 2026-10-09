// Month calendar layout and spending intensity for the Transactions calendar (display only).
import { addDays, monthRange, type IsoDate, type MonthKey } from './dates';

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** ISO weekday of a calendar date (computed in UTC, so time zones can't shift it). */
export function weekdayOf(date: IsoDate): Weekday {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as Weekday;
}

/**
 * The month as weeks of 7 cells, starting on `firstDay`. Cells outside the month are null, so
 * every row lines up under the weekday headings.
 */
export function monthGrid(month: MonthKey, firstDay: Weekday): (IsoDate | null)[][] {
  const { first, last } = monthRange(month);
  const leading = (weekdayOf(first) - firstDay + 7) % 7;
  const cells: (IsoDate | null)[] = Array.from({ length: leading }, () => null);
  for (let date = first; date <= last; date = addDays(date, 1)) cells.push(date);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The seven weekdays in display order, starting on `firstDay`. */
export function weekdayOrder(firstDay: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => (((firstDay - 1 + i) % 7) + 1) as Weekday);
}

/** A date that falls on the given ISO weekday (Monday 5 October 2026 + n), for naming weekdays. */
export function sampleDateFor(weekday: Weekday): IsoDate {
  return addDays('2026-10-05', weekday - 1);
}

/**
 * How strongly to tint a day by its spending, relative to the month's biggest day: 0 (nothing
 * spent) to 4. Square-root scaled so ordinary days stay visible next to a rent day.
 */
export function spendLevel(expenseMinor: number, maxExpenseMinor: number): 0 | 1 | 2 | 3 | 4 {
  if (expenseMinor <= 0 || maxExpenseMinor <= 0) return 0;
  const ratio = Math.sqrt(Math.min(expenseMinor, maxExpenseMinor) / maxExpenseMinor);
  return Math.max(1, Math.ceil(ratio * 4)) as 1 | 2 | 3 | 4;
}

/** The day `delta` days away, kept inside the month (arrow-key moves in the calendar grid). */
export function moveWithinMonth(date: IsoDate, delta: number, month: MonthKey): IsoDate {
  const { first, last } = monthRange(month);
  const target = addDays(date, delta);
  return target < first ? first : target > last ? last : target;
}
