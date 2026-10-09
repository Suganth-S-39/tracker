import { createElement } from 'react';
import { cx } from '@/lib/cx';
import { categoryIcon } from './icons';

type Tone = 'expense' | 'income' | 'savings' | 'investment' | 'neutral';

const tones: Record<Tone, string> = {
  expense: 'bg-expense-tint text-expense-strong',
  income: 'bg-income-tint text-income-strong',
  savings: 'bg-savings-tint text-savings-strong',
  investment: 'bg-investment-tint text-investment-strong',
  neutral: 'bg-accent-tint text-accent-strong',
};

/**
 * A category's icon glyph. The icon components are module-level constants looked up by key, so
 * nothing is created during render.
 */
export function CategoryGlyph({ icon, className }: { icon: string; className?: string }) {
  return createElement(categoryIcon(icon), { 'aria-hidden': true, className });
}

/** Category icon in a tinted circle. Decorative: the category name is always shown next to it. */
export function CategoryIcon({ icon, tone = 'neutral', className }: { icon: string; tone?: Tone; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('grid size-10 shrink-0 place-items-center rounded-full', tones[tone], className)}>
      <CategoryGlyph icon={icon} className="size-5" />
    </span>
  );
}
