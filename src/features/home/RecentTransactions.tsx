import { CalendarX2, Plus, Sparkles } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategoryMap } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { useHasAnyTransactions, useRecentTransactions } from '@/features/transactions/api';
import { useTransactionEditor } from '@/features/transactions/editor-context';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { formatMonth, type MonthKey } from '@/domain/dates';
import { strings } from '@/strings/en';

export function RecentTransactions({ month, money }: { month: MonthKey; money: MoneyContext | null }) {
  const recent = useRecentTransactions(month);
  const hasAny = useHasAnyTransactions();
  const categories = useCategoryMap();
  const editor = useTransactionEditor();
  const headingId = useId();

  let body;
  if (recent.isError && recent.data === undefined) {
    body = <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />;
  } else if (recent.isPending || hasAny.isPending || !money) {
    body = (
      <div className="flex flex-col gap-1 px-2 pb-2" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  } else if (recent.data.length === 0) {
    const addButton = (
      <Button onClick={() => editor.openCreate()} icon={<Plus aria-hidden="true" className="size-4" />}>
        {hasAny.data ? strings.nav.addLong : strings.home.addFirst}
      </Button>
    );
    // A brand-new account gets a welcome that guides the first action (spec section 11).
    body = hasAny.data ? (
      <EmptyState
        icon={CalendarX2}
        title={strings.home.emptyMonthTitle(formatMonth(month))}
        body={strings.home.emptyMonthBody}
        action={addButton}
      />
    ) : (
      <EmptyState icon={Sparkles} title={strings.home.welcomeTitle} body={strings.home.welcomeBody} action={addButton} />
    );
  } else {
    body = (
      <div className="flex flex-col gap-0.5 px-1 pb-1">
        {recent.data.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            category={categories.get(transaction.category_id)}
            money={money}
            onOpen={editor.openEdit}
          />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <section aria-labelledby={headingId}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 id={headingId} className="text-lg font-bold">
            {strings.home.recent}
          </h2>
          <Link
            to="/transactions"
            aria-label={strings.home.seeAllLabel}
            className="rounded-control px-2 py-1 text-sm font-semibold text-accent-strong hover:bg-hover"
          >
            {strings.home.seeAll}
          </Link>
        </div>
        {body}
      </section>
    </Card>
  );
}
