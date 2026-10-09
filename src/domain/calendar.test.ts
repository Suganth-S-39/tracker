import { describe, expect, it } from 'vitest';
import { monthGrid, moveWithinMonth, sampleDateFor, spendLevel, weekdayOf, weekdayOrder } from './calendar';
import { formatDayLong, formatWeekday } from './dates';

describe('weekdayOf', () => {
  it('gives ISO weekdays', () => {
    expect(weekdayOf('2026-10-05')).toBe(1); // Monday
    expect(weekdayOf('2026-10-11')).toBe(7); // Sunday
  });
});

describe('monthGrid', () => {
  it('lays out October 2026 from Monday (it starts on a Thursday)', () => {
    const weeks = monthGrid('2026-10', 1);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.at(-1)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks).toHaveLength(5);
  });

  it('lays out from Sunday', () => {
    const weeks = monthGrid('2026-10', 7);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('handles leap-year February and full weeks', () => {
    const weeks = monthGrid('2027-02', 1); // Feb 2027 starts on a Monday, 28 days
    expect(weeks).toHaveLength(4);
    expect(weeks[0]![0]).toBe('2027-02-01');
    expect(monthGrid('2028-02', 1).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('weekdayOrder', () => {
  it('rotates from the first day', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdayOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });
});

describe('spendLevel', () => {
  it('is 0 without spending and 4 on the biggest day', () => {
    expect(spendLevel(0, 1000)).toBe(0);
    expect(spendLevel(1000, 1000)).toBe(4);
    expect(spendLevel(500, 0)).toBe(0);
  });

  it('keeps small days visible next to a large one', () => {
    expect(spendLevel(1, 1_000_000)).toBe(1);
    expect(spendLevel(250_000, 1_000_000)).toBe(2);
    expect(spendLevel(600_000, 1_000_000)).toBe(4);
  });
});

describe('moveWithinMonth', () => {
  it('moves by days and weeks, clamped to the month', () => {
    expect(moveWithinMonth('2026-10-10', 7, '2026-10')).toBe('2026-10-17');
    expect(moveWithinMonth('2026-10-30', 7, '2026-10')).toBe('2026-10-31');
    expect(moveWithinMonth('2026-10-02', -7, '2026-10')).toBe('2026-10-01');
  });
});

describe('weekday names', () => {
  it('names each ISO weekday', () => {
    expect(formatWeekday(sampleDateFor(1), 'short', 'en-US')).toBe('Mon');
    expect(formatWeekday(sampleDateFor(7), 'long', 'en-US')).toBe('Sunday');
  });

  it('formats long day names for screen readers', () => {
    expect(formatDayLong('2026-10-09', 'en-US')).toBe('Friday, October 9');
  });
});
