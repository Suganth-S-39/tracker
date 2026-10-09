// Keyboard navigation for the Select listbox (pure, unit tested).

/**
 * The index `delta` enabled options away from `current` (clamped at the ends, like a native
 * select). With nothing active yet (-1), moving forward starts from the first option and moving
 * back from the last. Returns `current` when there is nowhere to go.
 */
export function moveIndex(current: number, delta: number, disabled: readonly boolean[]): number {
  const count = disabled.length;
  const step = delta >= 0 ? 1 : -1;
  let position = current < 0 ? (step > 0 ? -1 : count) : current;
  let remaining = Math.max(1, Math.abs(delta));
  let best = current;
  while (remaining > 0) {
    position += step;
    if (position < 0 || position >= count) break;
    if (!disabled[position]) {
      best = position;
      remaining--;
    }
  }
  return best;
}

/** The first or last enabled index, or -1 when every option is disabled. */
export function edgeIndex(edge: 'first' | 'last', disabled: readonly boolean[]): number {
  return edge === 'first' ? disabled.findIndex((d) => !d) : disabled.findLastIndex((d) => !d);
}

/**
 * Type-to-select: the first enabled option after `from` whose label starts with `query`
 * (case-insensitive), wrapping around. Repeating one letter cycles through the options starting
 * with it, as in a native select. Returns -1 when nothing matches.
 */
export function findTypeahead(labels: readonly string[], disabled: readonly boolean[], query: string, from: number): number {
  const q = query.toLocaleLowerCase();
  if (!q || labels.length === 0) return -1;
  const repeated = [...q].every((c) => c === q[0]);
  const needle = repeated ? q[0]! : q;
  // A longer query may still match the current option ("tr" while on "Transport").
  const start = repeated ? from + 1 : Math.max(from, 0);
  for (let i = 0; i < labels.length; i++) {
    const index = (((start + i) % labels.length) + labels.length) % labels.length;
    if (!disabled[index] && labels[index]!.toLocaleLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
