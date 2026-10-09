import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Wraps data that may still be the previous month's (or the previous filter's) while the new data
 * loads: shown slightly dimmed and marked busy, instead of flashing loading placeholders. Pair it
 * with `placeholderData: keepPreviousData` on the query and pass `query.isPlaceholderData`.
 */
export function Stale({ stale, className, children }: { stale: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      aria-busy={stale || undefined}
      className={cx('transition-opacity duration-200 motion-reduce:transition-none', stale && 'opacity-60', className)}
    >
      {children}
    </div>
  );
}
