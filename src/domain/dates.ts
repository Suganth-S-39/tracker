// Plain calendar dates (spec section 5): a transaction's date is "YYYY-MM-DD" with no time or
// time zone. "Today" comes from the browser's time zone. Formatting happens in UTC so a plain
// date is never shifted by the viewer's offset.

export type IsoDate = string; // YYYY-MM-DD
export type MonthKey = string; // YYYY-MM

const pad = (n: number) => String(n).padStart(2, '0');

/** Today in the browser's time zone. */
export function todayLocal(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): IsoDate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** First and last day of a month. */
export function monthRange(month: MonthKey): { first: IsoDate; last: IsoDate } {
  const first = `${month}-01`;
  return { first, last: addDays(`${addMonths(month, 1)}-01`, -1) };
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let fmt = dateFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    dateFormatters.set(key, fmt);
  }
  return fmt;
}

/** "October 2026" */
export function formatMonth(month: MonthKey, locale?: string): string {
  return dateFormatter(locale, { month: 'long', year: 'numeric' }).format(toUtc(`${month}-01`));
}

/** "Oct 2026" */
export function formatMonthShort(month: MonthKey, locale?: string): string {
  return dateFormatter(locale, { month: 'short', year: 'numeric' }).format(toUtc(`${month}-01`));
}

/** "Oct" (chart labels). */
export function formatMonthAbbrev(month: MonthKey, locale?: string): string {
  return dateFormatter(locale, { month: 'short' }).format(toUtc(`${month}-01`));
}

/**
 * Day heading for grouped lists: today / yesterday labels from the caller, otherwise
 * "Mon, Oct 6", with the year added when it isn't the current year.
 */
export function formatDayHeading(
  date: IsoDate,
  today: IsoDate,
  labels: { today: string; yesterday: string },
  locale?: string,
): string {
  if (date === today) return labels.today;
  if (date === addDays(today, -1)) return labels.yesterday;
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return dateFormatter(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(toUtc(date));
}

/** "Oct 6, 2026" */
export function formatDate(date: IsoDate, locale?: string): string {
  return dateFormatter(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(toUtc(date));
}
