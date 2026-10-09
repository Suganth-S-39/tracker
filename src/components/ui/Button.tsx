import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-strong text-on-accent hover:opacity-90 active:opacity-80',
  secondary: 'bg-control text-fg hover:bg-hover',
  ghost: 'text-fg hover:bg-hover',
  // Destructive confirmations. The page background color reads well on expense-strong (tested).
  danger: 'bg-expense-strong text-bg hover:opacity-90 active:opacity-80',
};

const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-13 px-5 text-base',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-opacity',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}
