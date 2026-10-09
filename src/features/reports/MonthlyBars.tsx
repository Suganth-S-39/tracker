import type { MoneyContext } from '@/features/money/useMoney';
import { niceScale } from '@/domain/charts';
import { formatMonth, formatMonthAbbrev, type MonthKey } from '@/domain/dates';
import { formatMoney, formatMoneyCompact } from '@/domain/money';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import type { MonthTotals } from './api';

/** On phones only the most recent months fit. */
const PHONE_MONTHS = 6;

type MonthlyBarsProps = {
  months: readonly MonthTotals[];
  selected: MonthKey;
  onSelect: (month: MonthKey) => void;
  money: MoneyContext;
};

/**
 * Income vs expenses per month (owner addition). Each month is a button, labelled with both
 * totals, that opens that month across the app. Income bars are green and expense bars red,
 * with a legend, so the meaning never depends on color alone.
 */
export function MonthlyBars({ months, selected, onSelect, money }: MonthlyBarsProps) {
  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  const max = Math.max(0, ...months.flatMap((m) => [m.incomeMinor, m.expenseMinor]));
  const scale = niceScale(max);
  const height = (minor: number) => (scale.max === 0 ? 0 : (minor / scale.max) * 100);

  return (
    <div>
      {/* Extra space below: the top axis label sits half above the plot area. */}
      <div className="mb-6 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-income" />
          {strings.reports.legend.income}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-expense" />
          {strings.reports.legend.expense}
        </span>
      </div>

      <div className="flex gap-2">
        {/* Y axis */}
        <div aria-hidden="true" className="relative h-48 w-12 shrink-0 text-right text-xs text-fg-muted tabular">
          {scale.ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${height(tick)}%` }}
            >
              {formatMoneyCompact(tick, money.baseCurrency, exponent)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid lines */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48">
            {scale.ticks.map((tick) => (
              <div key={tick} className="absolute inset-x-0 border-t border-divider" style={{ bottom: `${height(tick)}%` }} />
            ))}
          </div>

          <ul className="relative flex items-end gap-1">
            {months.map((m, index) => {
              const isSelected = m.month === selected;
              return (
                <li
                  key={m.month}
                  className={cx('min-w-0 flex-1', index < months.length - PHONE_MONTHS && 'hidden wide:block')}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(m.month)}
                    aria-pressed={isSelected}
                    aria-label={strings.reports.monthBarLabel(formatMonth(m.month), fmt(m.incomeMinor), fmt(m.expenseMinor))}
                    className={cx(
                      'flex w-full flex-col items-center rounded-control pb-1 hover:bg-hover',
                      isSelected && 'bg-accent-tint',
                    )}
                  >
                    <span className="flex h-48 w-full items-end justify-center gap-0.5 px-0.5">
                      <span className="w-1/3 max-w-4 rounded-t-sm bg-income" style={{ height: `${height(m.incomeMinor)}%` }} />
                      <span className="w-1/3 max-w-4 rounded-t-sm bg-expense" style={{ height: `${height(m.expenseMinor)}%` }} />
                    </span>
                    <span className={cx('mt-1.5 text-xs', isSelected ? 'font-bold text-fg' : 'text-fg-muted')}>
                      {formatMonthAbbrev(m.month)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
