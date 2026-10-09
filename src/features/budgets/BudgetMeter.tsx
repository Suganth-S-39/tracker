import { CircleAlert, TriangleAlert } from 'lucide-react';
import { budgetUsage } from '@/domain/budget';
import { formatMoney } from '@/domain/money';
import type { MoneyContext } from '@/features/money/useMoney';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';

type BudgetMeterProps = {
  label: string;
  spentMinor: number;
  budgetMinor: number;
  money: MoneyContext;
  /** Smaller type for the Home snapshot. */
  compact?: boolean;
};

/**
 * Budget usage bar (spec section 9). Accent color while on track; from 80% it switches to the
 * expense color with an icon and a text label, never color alone. No new warning color.
 */
export function BudgetMeter({ label, spentMinor, budgetMinor, money, compact = false }: BudgetMeterProps) {
  const usage = budgetUsage(spentMinor, budgetMinor);
  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  const spent = fmt(spentMinor);
  const budget = fmt(budgetMinor);
  const warning = usage.state !== 'ok';
  const WarningIcon = usage.state === 'over' ? CircleAlert : TriangleAlert;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cx('min-w-0 truncate font-semibold', compact && 'text-sm')}>{label}</span>
        <span className="shrink-0 text-sm tabular">
          <span className="font-semibold">{spent}</span>
          <span className="text-fg-muted"> / {budget}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usage.barPercent}
        aria-valuetext={strings.budgets.meterText(usage.percent, spent, budget)}
        className={cx('mt-2 overflow-hidden rounded-full bg-control', compact ? 'h-2' : 'h-2.5')}
      >
        <div
          className={cx('h-full rounded-full', warning ? 'bg-expense' : 'bg-accent')}
          style={{ width: `${usage.barPercent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
        {warning ? (
          <span className="flex items-center gap-1 font-semibold text-expense-strong">
            <WarningIcon aria-hidden="true" className="size-4" />
            {strings.budgets.states[usage.state === 'over' ? 'over' : 'near']}
          </span>
        ) : (
          <span className="text-fg-muted tabular">{strings.budgets.percentUsed(usage.percent)}</span>
        )}
        <span className={cx('tabular', usage.remainingMinor < 0 ? 'font-semibold text-expense-strong' : 'text-fg-muted')}>
          {usage.remainingMinor < 0
            ? strings.budgets.over(fmt(-usage.remainingMinor))
            : strings.budgets.left(fmt(usage.remainingMinor))}
        </span>
      </div>
    </div>
  );
}
