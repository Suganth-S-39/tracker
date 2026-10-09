// Month-over-month change for Home's totals (display only).

export type MonthChange = { direction: 'up' | 'down' | 'same'; percent: number };

/**
 * How a total changed from last month, as a whole percent of last month's value. Null when last
 * month had nothing to compare with (a percentage of zero means nothing). A change that rounds
 * to 0% but isn't zero keeps its direction, so the display can say "<1%".
 */
export function monthChange(currentMinor: number, previousMinor: number): MonthChange | null {
  if (previousMinor <= 0) return null;
  const diff = currentMinor - previousMinor;
  if (diff === 0) return { direction: 'same', percent: 0 };
  return { direction: diff > 0 ? 'up' : 'down', percent: Math.round((Math.abs(diff) / previousMinor) * 100) };
}
