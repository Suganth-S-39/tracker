import { describe, expect, it } from 'vitest';
import { daysBetween } from './dates';
import { goalPaceWeeks, goalPlan, goalProgress, weeksAsDuration } from './goals';

describe('daysBetween', () => {
  it('counts whole days either way', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('goalProgress', () => {
  it('rounds the percentage down, so 100% means it is all there', () => {
    expect(goalProgress(850_000, 1_500_000)).toEqual({ percent: 56, fraction: 0.5666, remainingMinor: 650_000, reached: false });
    expect(goalProgress(1_499_999, 1_500_000)).toMatchObject({ percent: 99, reached: false, remainingMinor: 1 });
  });

  it('is reached at or above the target', () => {
    expect(goalProgress(1_500_000, 1_500_000)).toEqual({ percent: 100, fraction: 1, remainingMinor: 0, reached: true });
    expect(goalProgress(1_600_000, 1_500_000)).toEqual({ percent: 100, fraction: 1, remainingMinor: 0, reached: true });
  });

  it('treats an empty goal as zero', () => {
    expect(goalProgress(0, 500)).toEqual({ percent: 0, fraction: 0, remainingMinor: 500, reached: false });
  });

  it('stays exact for very large amounts', () => {
    const target = 9_000_000_000_000_000;
    expect(goalProgress(4_500_000_000_000_000, target)).toMatchObject({ percent: 50, fraction: 0.5, remainingMinor: 4_500_000_000_000_000 });
  });

  it('rejects a zero target and unsafe amounts', () => {
    expect(() => goalProgress(1, 0)).toThrow(RangeError);
    expect(() => goalProgress(0.5, 10)).toThrow(RangeError);
  });
});

describe('goalPlan', () => {
  const base = { savedMinor: 850_000, targetMinor: 1_500_000, today: '2026-10-10', exponent: 2 };

  it('spreads what is left over the weeks to the date, rounded up to whole rupees', () => {
    // 66 days -> 10 weeks; 6,500 / 10 = 650.
    expect(goalPlan({ ...base, targetDate: '2026-12-15' })).toEqual({ kind: 'weekly', perWeekMinor: 65_000, weeks: 10 });
    // 7 weeks exactly; 6,500 / 7 = 928.57 -> 929.
    expect(goalPlan({ ...base, targetDate: '2026-11-28' })).toEqual({ kind: 'weekly', perWeekMinor: 92_900, weeks: 7 });
  });

  it('asks for all of it this week when the date is within a week (or today)', () => {
    expect(goalPlan({ ...base, targetDate: '2026-10-10' })).toEqual({ kind: 'weekly', perWeekMinor: 650_000, weeks: 1 });
    expect(goalPlan({ ...base, targetDate: '2026-10-16' })).toMatchObject({ weeks: 1 });
  });

  it('rounds to the currency (no decimals for yen)', () => {
    expect(goalPlan({ savedMinor: 0, targetMinor: 1000, today: '2026-10-10', targetDate: '2026-10-31', exponent: 0 })).toEqual({
      kind: 'weekly',
      perWeekMinor: 334,
      weeks: 3,
    });
  });

  it('knows when there is no date, the date has passed, or the goal is reached', () => {
    expect(goalPlan({ ...base, targetDate: null })).toEqual({ kind: 'none' });
    expect(goalPlan({ ...base, targetDate: '2026-10-09' })).toEqual({ kind: 'late' });
    expect(goalPlan({ ...base, savedMinor: 1_500_000, targetDate: '2026-10-09' })).toEqual({ kind: 'reached' });
  });
});

describe('goalPaceWeeks', () => {
  const today = '2026-10-10';

  it('uses the last 8 weeks when the goal is older than that', () => {
    // 8,000 over 56 days = 1,000 a week; 6,500 left -> 7 weeks (6.5 rounded up).
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: 800_000, firstAddedOn: '2026-01-01', today })).toBe(7);
  });

  it('uses the days since the first saving when that is more recent', () => {
    // 3,000 over 21 days = 1,000 a week.
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: 300_000, firstAddedOn: '2026-09-20', today })).toBe(7);
  });

  it('spreads a brand-new goal over at least a week', () => {
    // 1,000 saved today counts as 1,000 a week, not 7,000.
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: 100_000, firstAddedOn: today, today })).toBe(7);
  });

  it('has no estimate without saving lately, or with nothing left to save', () => {
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: 0, firstAddedOn: '2026-01-01', today })).toBeNull();
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: -5_000, firstAddedOn: '2026-01-01', today })).toBeNull();
    expect(goalPaceWeeks({ remainingMinor: 650_000, recentNetMinor: 5_000, firstAddedOn: null, today })).toBeNull();
    expect(goalPaceWeeks({ remainingMinor: 0, recentNetMinor: 5_000, firstAddedOn: '2026-01-01', today })).toBeNull();
  });

  it('is at least one week', () => {
    expect(goalPaceWeeks({ remainingMinor: 1, recentNetMinor: 1_000_000, firstAddedOn: '2026-01-01', today })).toBe(1);
  });
});

describe('weeksAsDuration', () => {
  it('says weeks up to 8, then months, then years', () => {
    expect(weeksAsDuration(1)).toEqual({ unit: 'weeks', count: 1 });
    expect(weeksAsDuration(8)).toEqual({ unit: 'weeks', count: 8 });
    expect(weeksAsDuration(9)).toEqual({ unit: 'months', count: 2 });
    expect(weeksAsDuration(52)).toEqual({ unit: 'months', count: 12 });
    expect(weeksAsDuration(104)).toEqual({ unit: 'years', count: 2 });
  });
});
