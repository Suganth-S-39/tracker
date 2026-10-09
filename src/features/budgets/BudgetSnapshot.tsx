import { PiggyBank } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import { categoryLabel, useCategoryMap } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { formatMonth, type MonthKey } from '@/domain/dates';
import { strings } from '@/strings/en';
import { useBudgetStatus } from './api';
import { BudgetMeter } from './BudgetMeter';

const s = strings.budgets;
const SNAPSHOT_CATEGORIES = 3;

/** Home's budget snapshot: the overall budget plus the most-used category budgets. */
export function BudgetSnapshot({ month, money }: { month: MonthKey; money: MoneyContext | null }) {
  const status = useBudgetStatus(month);
  const categories = useCategoryMap();
  const headingId = useId();

  let body;
  if (status.isError && status.data === undefined) {
    body = <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  } else if (status.isPending || !money) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-14" />
        <Skeleton className="h-10" />
      </div>
    );
  } else {
    const overall = status.data.find((b) => b.categoryId === null);
    const top = status.data
      .filter((b) => b.categoryId !== null)
      .sort((a, b) => b.spentMinor / b.amountMinor - a.spentMinor / a.amountMinor)
      .slice(0, SNAPSHOT_CATEGORIES);

    body =
      !overall && top.length === 0 ? (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-strong">
            <PiggyBank className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg-muted">{s.emptyBody}</p>
            <Link to="/budgets" className="mt-1 inline-block text-sm font-semibold text-accent-strong hover:underline">
              {s.setOverall}
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {overall ? (
            <BudgetMeter
              label={formatMonth(month)}
              spentMinor={overall.spentMinor}
              budgetMinor={overall.amountMinor}
              money={money}
            />
          ) : null}
          {top.map((budget) => {
            const category = categories.get(budget.categoryId ?? '');
            return (
              <BudgetMeter
                key={budget.categoryId}
                compact
                label={category ? categoryLabel(category) : ''}
                spentMinor={budget.spentMinor}
                budgetMinor={budget.amountMinor}
                money={money}
              />
            );
          })}
        </div>
      );
  }

  return (
    <Card className="p-5">
      <section aria-labelledby={headingId}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id={headingId} className="text-lg font-bold">
            {s.snapshotTitle}
          </h2>
          <Link
            to="/budgets"
            aria-label={s.openLabel}
            className="rounded-control px-2 py-1 text-sm font-semibold text-accent-strong hover:bg-hover"
          >
            {s.open}
          </Link>
        </div>
        <Stale stale={status.isPlaceholderData}>{body}</Stale>
      </section>
    </Card>
  );
}
