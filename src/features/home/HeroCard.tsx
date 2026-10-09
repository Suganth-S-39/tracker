import { ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, Minus, PiggyBank, TrendingUp, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import type { MoneyContext } from '@/features/money/useMoney';
import { useMonthSummary, type MonthSummary } from '@/features/transactions/api';
import { addMonths, formatMonth, type MonthKey } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { monthChange, type MonthChange } from '@/domain/trends';
import { strings } from '@/strings/en';

const h = strings.home;

type Total = { key: 'income' | 'expense' | 'savings' | 'investment'; label: string; Icon: LucideIcon; field: keyof MonthSummary };

const TOTALS: readonly Total[] = [
  { key: 'income', label: h.income, Icon: ArrowDownLeft, field: 'income_minor' },
  { key: 'expense', label: h.expenses, Icon: ArrowUpRight, field: 'expense_minor' },
  { key: 'savings', label: h.savings, Icon: PiggyBank, field: 'savings_minor' },
  { key: 'investment', label: h.investments, Icon: TrendingUp, field: 'investment_minor' },
];

/** "↑ 12%" with a full sentence for screen readers. Neutral on the dark card: the arrow carries the meaning. */
function ChangeChip({ change, previousMonth }: { change: MonthChange; previousMonth: string }) {
  const Arrow = change.direction === 'up' ? ArrowUp : change.direction === 'down' ? ArrowDown : Minus;
  const percent = change.percent === 0 && change.direction !== 'same' ? h.change.lessThanOne : `${change.percent}%`;
  const sentence =
    change.direction === 'same'
      ? h.change.same(previousMonth)
      : h.change[change.direction](percent, previousMonth);
  return (
    <span title={sentence} className="inline-flex items-center gap-0.5 rounded-full bg-on-hero/15 px-1.5 py-0.5 text-xs font-semibold">
      <Arrow aria-hidden="true" className="size-3" strokeWidth={2.75} />
      <span aria-hidden="true">{change.direction === 'same' ? '0%' : percent}</span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}

/**
 * The selected month at a glance (spec section 8, plus savings and investments): what's left
 * (income minus expenses, savings and investments; IOU-linked transactions excluded, in SQL),
 * then each total with its change from last month. Every total has its own icon, not just a color.
 */
export function HeroCard({ month, money }: { month: MonthKey; money: MoneyContext | null }) {
  const summary = useMonthSummary(month);
  const previousMonth = addMonths(month, -1);
  const previous = useMonthSummary(previousMonth);
  const headingId = useId();

  if (summary.isError && summary.data === undefined) {
    return (
      <Card>
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      </Card>
    );
  }

  const ready = summary.data && money;
  const fmt = (minor: number, sign?: 'exceptZero') =>
    money ? formatMoney(minor, money.baseCurrency, money.exponentOf(money.baseCurrency), sign ? { sign } : {}) : '';

  return (
    <section aria-labelledby={headingId} className="rounded-card bg-hero p-5 text-on-hero shadow-raised wide:p-6">
      <h2 id={headingId} className="font-sans text-sm font-medium tracking-normal opacity-90">
        {h.balanceFor(formatMonth(month))}
      </h2>
      <Stale stale={summary.isPlaceholderData}>
        {ready ? (
          <p className="mt-1 font-display text-[2.75rem] leading-tight font-semibold tracking-tight tabular" data-testid="balance">
            {fmt(summary.data.net_minor, 'exceptZero')}
          </p>
        ) : (
          <Skeleton className="mt-2 h-10 w-48 bg-hero-tile" />
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3">
          {TOTALS.map(({ key, label, Icon, field }) => {
            const value = summary.data?.[field];
            const change = ready && previous.data && value !== undefined ? monthChange(value, previous.data[field]) : null;
            return (
              <div key={key} className="rounded-2xl border border-on-hero/15 bg-hero-tile p-3">
                <dt className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-on-hero/20">
                    <Icon className="size-4" strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 truncate">{label}</span>
                </dt>
                <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-lg font-bold tabular" data-testid={`total-${key}`}>
                    {ready && value !== undefined ? fmt(value) : <Skeleton className="h-6 w-24 bg-hero-tile" />}
                  </span>
                  {change ? <ChangeChip change={change} previousMonth={formatMonth(previousMonth)} /> : null}
                </dd>
              </div>
            );
          })}
        </dl>
      </Stale>
    </section>
  );
}
