// Chart geometry for Reports. Pure TypeScript, no React.

export type DonutInput<K extends string> = { key: K; value: number };

export type DonutSlice<K extends string> = {
  key: K | 'other';
  value: number;
  /** Share of the total, 0-1. */
  fraction: number;
  /** Where the slice starts around the circle, 0-1. */
  start: number;
  /** Whole percentages that always add up to 100 (largest remainder). */
  percent: number;
  /** Keys folded into "Other" (empty for real slices). */
  members: K[];
};

/**
 * Turns category totals into donut slices: the largest `maxSlices` stay separate and the rest
 * become one "Other" slice (DECISIONS.md: top 7 plus Other). If folding would leave a single
 * category in Other, it is shown on its own instead.
 */
export function donutSlices<K extends string>(items: ReadonlyArray<DonutInput<K>>, maxSlices = 7): DonutSlice<K>[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) return [];

  const keep = positive.length <= maxSlices + 1 ? positive : positive.slice(0, maxSlices);
  const rest = positive.slice(keep.length);
  const groups: Array<{ key: K | 'other'; value: number; members: K[] }> = keep.map((i) => ({
    key: i.key,
    value: i.value,
    members: [],
  }));
  if (rest.length > 0) {
    groups.push({ key: 'other', value: rest.reduce((sum, i) => sum + i.value, 0), members: rest.map((i) => i.key) });
  }

  const percents = largestRemainderPercents(groups.map((g) => g.value), total);
  let start = 0;
  return groups.map((group, index) => {
    const fraction = group.value / total;
    const slice = { ...group, fraction, start, percent: percents[index] ?? 0 };
    start += fraction;
    return slice;
  });
}

/** Whole percentages that sum to exactly 100. */
export function largestRemainderPercents(values: readonly number[], total: number): number[] {
  const exact = values.map((v) => (v * 100) / total);
  const floors = exact.map(Math.floor);
  let leftover = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, remainder: e - Math.floor(e) })).sort((a, b) => b.remainder - a.remainder);
  for (const { i } of order) {
    if (leftover <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    leftover -= 1;
  }
  return floors;
}

/**
 * A "nice" axis for bar charts: the smallest max of the form {1, 2, 2.5, 5} x 10^n that fits the
 * largest value, split into `ticks` equal steps. Values are minor units.
 */
export function niceScale(maxValue: number, ticks = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 0, ticks: [0] };
  const rawStep = maxValue / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;
  const max = step * ticks;
  return { max, ticks: Array.from({ length: ticks + 1 }, (_, i) => step * i) };
}
