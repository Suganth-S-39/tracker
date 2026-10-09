import { describe, expect, it } from 'vitest';
import { monthChange } from './trends';

describe('monthChange', () => {
  it('gives the direction and whole percent of last month', () => {
    expect(monthChange(112_000, 100_000)).toEqual({ direction: 'up', percent: 12 });
    expect(monthChange(75_000, 100_000)).toEqual({ direction: 'down', percent: 25 });
    expect(monthChange(300_000, 100_000)).toEqual({ direction: 'up', percent: 200 });
  });

  it('reports no change', () => {
    expect(monthChange(100_000, 100_000)).toEqual({ direction: 'same', percent: 0 });
  });

  it('keeps the direction of tiny changes (shown as <1%)', () => {
    expect(monthChange(100_001, 100_000)).toEqual({ direction: 'up', percent: 0 });
  });

  it('has nothing to compare with when last month was zero', () => {
    expect(monthChange(50_000, 0)).toBeNull();
    expect(monthChange(0, 0)).toBeNull();
  });

  it('handles a drop to zero', () => {
    expect(monthChange(0, 100_000)).toEqual({ direction: 'down', percent: 100 });
  });
});
