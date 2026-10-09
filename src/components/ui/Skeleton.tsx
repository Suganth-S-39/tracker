import { cx } from '@/lib/cx';

/** Placeholder block sized like the content it stands in for, so nothing jumps when data arrives. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-control bg-hover motion-reduce:animate-none', className)} />;
}
