import { describe, expect, it } from 'vitest';
import { donutSlices, largestRemainderPercents, niceScale } from './charts';

describe('donutSlices', () => {
  it('orders slices largest first, with fractions and start positions', () => {
    const slices = donutSlices([
      { key: 'food', value: 100 },
      { key: 'rent', value: 300 },
    ]);
    expect(slices.map((s) => [s.key, s.fraction, s.start, s.percent])).toEqual([
      ['rent', 0.75, 0, 75],
      ['food', 0.25, 0.75, 25],
    ]);
  });

  it('folds everything after the top 7 into Other', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, value: 100 - i }));
    const slices = donutSlices(items);
    expect(slices).toHaveLength(8);
    expect(slices.at(-1)).toMatchObject({ key: 'other', value: 93 + 92 + 91, members: ['c7', 'c8', 'c9'] });
  });

  it('shows an eighth category on its own rather than as a one-item Other', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, value: 10 }));
    expect(donutSlices(items).map((s) => s.key)).not.toContain('other');
  });

  it('percentages always add up to 100', () => {
    const slices = donutSlices([
      { key: 'a', value: 1 },
      { key: 'b', value: 1 },
      { key: 'c', value: 1 },
    ]);
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    expect(slices.map((s) => s.percent)).toEqual([34, 33, 33]);
  });

  it('ignores zero values and handles no data', () => {
    expect(donutSlices([{ key: 'a', value: 0 }])).toEqual([]);
    expect(donutSlices([])).toEqual([]);
  });
});

describe('largestRemainderPercents', () => {
  it('distributes the leftover to the largest remainders', () => {
    expect(largestRemainderPercents([1, 1, 1], 3)).toEqual([34, 33, 33]);
    expect(largestRemainderPercents([2, 1], 3)).toEqual([67, 33]);
  });
});

describe('niceScale', () => {
  it.each([
    [0, 0, [0]],
    [7, 8, [0, 2, 4, 6, 8]],
    [930, 1000, [0, 250, 500, 750, 1000]],
    [24_500_000, 40_000_000, [0, 10_000_000, 20_000_000, 30_000_000, 40_000_000]],
    [100, 100, [0, 25, 50, 75, 100]],
  ])('max %i -> axis max %i', (value, max, ticks) => {
    expect(niceScale(value)).toEqual({ max, ticks });
  });
});
