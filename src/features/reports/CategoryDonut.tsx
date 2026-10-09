import { categoryLabel, type Category } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { donutSlices } from '@/domain/charts';
import { formatMoney } from '@/domain/money';
import { strings } from '@/strings/en';
import type { CategorySpending } from './api';
import { sliceBg, sliceStroke } from './chartColors';

const SIZE = 200;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Gap between slices, in px along the ring. */
const GAP = 3;

type CategoryDonutProps = {
  spending: readonly CategorySpending[];
  categories: ReadonlyMap<string, Category>;
  money: MoneyContext;
  monthName: string;
};

/**
 * Spending by category (spec section 8): a donut plus a ranked list, in the base currency.
 * Hand-rolled SVG (DECISIONS.md): tiny, themeable, and the list carries the same data for
 * screen readers and anyone who can't tell the colors apart.
 */
export function CategoryDonut({ spending, categories, money, monthName }: CategoryDonutProps) {
  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  const total = spending.reduce((sum, item) => sum + item.spentMinor, 0);
  const slices = donutSlices(spending.map((item) => ({ key: item.categoryId, value: item.spentMinor })));
  const labelOf = (key: string) => {
    if (key === 'other') return strings.reports.other;
    const category = categories.get(key);
    return category ? categoryLabel(category) : '';
  };

  return (
    <div className="flex flex-col items-center gap-6 wide:flex-row wide:items-start">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-52 -rotate-90"
          role="img"
          aria-label={strings.reports.donutLabel(monthName, fmt(total))}
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-control" />
          {slices.map((slice, index) => {
            const length = Math.max(0, slice.fraction * CIRCUMFERENCE - (slices.length > 1 ? GAP : 0));
            return (
              <circle
                key={slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-slice.start * CIRCUMFERENCE}
                className={sliceStroke(index, slice.key === 'other')}
              />
            );
          })}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 grid place-content-center text-center">
          <span className="text-xs font-medium text-fg-muted">{strings.reports.totalSpent}</span>
          <span className="font-display text-xl font-bold tracking-tight tabular">{fmt(total)}</span>
        </div>
      </div>

      <ol className="flex w-full min-w-0 flex-col gap-3" aria-label={strings.reports.byCategory}>
        {slices.map((slice, index) => (
          <li key={slice.key} data-testid="category-share">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${sliceBg(index, slice.key === 'other')}`} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {labelOf(slice.key)}
                {slice.key === 'other' ? (
                  <span className="block text-xs font-normal text-fg-muted">
                    {strings.reports.otherMembers(slice.members.length)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm text-fg-muted tabular">{slice.percent}%</span>
              <span className="w-28 shrink-0 text-right font-semibold tabular">{fmt(slice.value)}</span>
            </div>
            <div aria-hidden="true" className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-control">
              <div
                className={`h-full rounded-full ${sliceBg(index, slice.key === 'other')}`}
                style={{ width: `${slice.fraction * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
