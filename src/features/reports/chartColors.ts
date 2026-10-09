// Static class names (Tailwind only generates classes it can see in the source).
// Category slices take colors by rank (open item 5); "Other" is always gray.

export const SLICE_BG = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6', 'bg-chart-7'] as const;
export const SLICE_STROKE = [
  'stroke-chart-1',
  'stroke-chart-2',
  'stroke-chart-3',
  'stroke-chart-4',
  'stroke-chart-5',
  'stroke-chart-6',
  'stroke-chart-7',
] as const;

export function sliceBg(index: number, isOther: boolean): string {
  return isOther ? 'bg-chart-other' : (SLICE_BG[index % SLICE_BG.length] ?? 'bg-chart-other');
}

export function sliceStroke(index: number, isOther: boolean): string {
  return isOther ? 'stroke-chart-other' : (SLICE_STROKE[index % SLICE_STROKE.length] ?? 'stroke-chart-other');
}
