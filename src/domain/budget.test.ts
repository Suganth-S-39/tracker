import { describe, expect, it } from 'vitest';
import { budgetUsage } from './budget';

describe('budgetUsage', () => {
  it('is on track below 80%', () => {
    expect(budgetUsage(0, 1000)).toEqual({ percent: 0, barPercent: 0, state: 'ok', remainingMinor: 1000 });
    expect(budgetUsage(799, 1000)).toMatchObject({ percent: 79, state: 'ok' });
  });

  it('is near the limit from exactly 80%', () => {
    expect(budgetUsage(800, 1000)).toMatchObject({ percent: 80, state: 'near', remainingMinor: 200 });
    expect(budgetUsage(999, 1000)).toMatchObject({ percent: 99, state: 'near' });
  });

  it('is over from exactly 100%', () => {
    expect(budgetUsage(1000, 1000)).toMatchObject({ percent: 100, barPercent: 100, state: 'over', remainingMinor: 0 });
    expect(budgetUsage(1500, 1000)).toMatchObject({ percent: 150, barPercent: 100, state: 'over', remainingMinor: -500 });
  });

  it('rounds the percentage down, so 79.99% is not yet "near"', () => {
    expect(budgetUsage(7999, 10000)).toMatchObject({ percent: 79, state: 'ok' });
  });

  it('stays exact for very large amounts', () => {
    const budget = 9_000_000_000_000_000; // beyond 2^53 / 100: float math would drift here
    expect(budgetUsage(7_200_000_000_000_000, budget)).toMatchObject({ percent: 80, state: 'near' });
  });

  it('rejects a zero budget', () => {
    expect(() => budgetUsage(10, 0)).toThrow(RangeError);
  });
});
