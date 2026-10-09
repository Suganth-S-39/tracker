import type { HTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

/** A liquid-glass panel. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('glass rounded-card', className)} {...rest} />;
}
