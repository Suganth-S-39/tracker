import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useId } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import { ErrorState } from '@/components/ui/ErrorState';
import { Card } from '@/components/ui/Card';
import type { MoneyContext } from '@/features/money/useMoney';
import { useMonthSummary } from '@/features/transactions/api';
import { formatMonth, type MonthKey } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { strings } from '@/strings/en';

/**
 * Balance for the selected month = income - expenses (spec section 8). IOU-linked transactions
 * are excluded in SQL. Income and expense each carry an arrow, not just a color.
 */
export function HeroCard({ month, money }: { month: MonthKey; money: MoneyContext | null }) {
  const summary = useMonthSummary(month);
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
        {strings.home.balanceFor(formatMonth(month))}
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
          {(
            [
              { key: 'income', label: strings.home.income, Icon: ArrowDownLeft, value: summary.data?.income_minor },
              { key: 'expense', label: strings.home.expenses, Icon: ArrowUpRight, value: summary.data?.expense_minor },
            ] as const
          ).map(({ key, label, Icon, value }) => (
            <div key={key} className="rounded-2xl border border-on-hero/15 bg-hero-tile p-3">
              <dt className="flex items-center gap-2 text-sm font-medium">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-on-hero/20">
                  <Icon className="size-4" strokeWidth={2.5} />
                </span>
                {label}
              </dt>
              <dd className="mt-1.5 text-lg font-bold tabular" data-testid={`total-${key}`}>
                {ready && value !== undefined ? fmt(value) : <Skeleton className="h-6 w-24 bg-hero-tile" />}
              </dd>
            </div>
          ))}
        </dl>
      </Stale>
    </section>
  );
}
