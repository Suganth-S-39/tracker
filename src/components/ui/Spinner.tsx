import { cx } from '@/lib/cx';

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none',
        size === 'sm' ? 'size-4' : 'size-6',
        className,
      )}
    />
  );
}
