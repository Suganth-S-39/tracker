import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatDayHeading,
  formatMonth,
  isIsoDate,
  monthOf,
  monthRange,
  todayLocal,
} from './dates';

const labels = { today: 'Today', yesterday: 'Yesterday' };

describe('todayLocal', () => {
  it('uses local calendar fields, not UTC', () => {
    // 23:30 local on Oct 6 stays Oct 6 whatever the offset.
    expect(todayLocal(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
    expect(todayLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('adds months', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -14)).toBe('2025-08');
  });

  it('gives month ranges, including February in leap years', () => {
    expect(monthRange('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthRange('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
  });

  it('extracts the month of a date', () => {
    expect(monthOf('2026-10-06')).toBe('2026-10');
  });

  it('validates plain dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('06/10/2026')).toBe(false);
  });
});

describe('formatting', () => {
  it('names months', () => {
    expect(formatMonth('2026-10', 'en-US')).toBe('October 2026');
  });

  it('labels today and yesterday, and adds the year only when needed', () => {
    expect(formatDayHeading('2026-10-06', '2026-10-06', labels, 'en-US')).toBe('Today');
    expect(formatDayHeading('2026-10-05', '2026-10-06', labels, 'en-US')).toBe('Yesterday');
    expect(formatDayHeading('2026-10-01', '2026-10-06', labels, 'en-US')).toBe('Thu, Oct 1');
    expect(formatDayHeading('2025-12-31', '2026-01-02', labels, 'en-US')).toBe('Wed, Dec 31, 2025');
  });

  it('never shifts a plain date by the time zone', () => {
    // Formatting in UTC: Jan 1 stays Jan 1 for viewers west of UTC.
    expect(formatDayHeading('2026-01-01', '2026-03-01', labels, 'en-US')).toBe('Thu, Jan 1');
  });
});
