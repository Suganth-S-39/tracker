import { ChartPie } from 'lucide-react';
import { useId, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import { Switch } from '@/components/ui/Switch';
import { useCategoryMap } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { MonthSelector } from '@/features/month/MonthSelector';
import { useSelectedMonth } from '@/features/month/month-context';
import { addMonths, formatMonth } from '@/domain/dates';
import { strings } from '@/strings/en';
import { useMonthlyTotals, useSpendingByCategory } from './api';
import { CategoryDonut } from './CategoryDonut';
import { MonthlyBars } from './MonthlyBars';

const s = strings.reports;
const CHART_MONTHS = 12;

/** Reports (spec section 8, plus the owner's bar chart). */
export function ReportsPage() {
  const { month, setMonth } = useSelectedMonth();
  const [excludeIou, setExcludeIou] = useState(true);
  const money = useMoney();
  const categories = useCategoryMap();
  const spending = useSpendingByCategory(month, excludeIou);
  const monthly = useMonthlyTotals(addMonths(month, -(CHART_MONTHS - 1)), month, excludeIou);
  const donutHeading = useId();
  const barsHeading = useId();
  const monthName = formatMonth(month);

  return (
    <>
      <PageHeader title={strings.pages.reports.title} actions={<MonthSelector />} />

      <Card className="mt-2 mb-4 p-4">
        <Switch label={s.excludeIou} hint={s.excludeIouHint} checked={excludeIou} onChange={setExcludeIou} />
      </Card>

      <div className="grid gap-4">
        <Card className="p-5">
          <section aria-labelledby={donutHeading}>
            <h2 id={donutHeading} className="mb-5 text-xl font-bold">
              {s.byCategory}
            </h2>
            <Stale stale={spending.isPlaceholderData}>
              {(spending.isError && spending.data === undefined) ? (
                <ErrorState error={spending.error} onRetry={() => void spending.refetch()} />
              ) : spending.isPending || !money ? (
                <div className="flex flex-col items-center gap-6 wide:flex-row" aria-busy="true">
                  <Skeleton className="size-52 rounded-full" />
                  <div className="flex w-full flex-col gap-3">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                </div>
              ) : spending.data.length === 0 ? (
                <EmptyState icon={ChartPie} title={s.emptyTitle(monthName)} body={s.emptyBody} />
              ) : (
                <CategoryDonut spending={spending.data} categories={categories} money={money} monthName={monthName} />
              )}
            </Stale>
          </section>
        </Card>

        <Card className="p-5">
          <section aria-labelledby={barsHeading}>
            <h2 id={barsHeading} className="text-xl font-bold">
              {s.incomeVsExpenses}
            </h2>
            <p className="mb-4 text-sm text-fg-muted">{s.incomeVsExpensesHint}</p>
            <Stale stale={monthly.isPlaceholderData}>
              {(monthly.isError && monthly.data === undefined) ? (
                <ErrorState error={monthly.error} onRetry={() => void monthly.refetch()} />
              ) : monthly.isPending || !money ? (
                <Skeleton className="h-60" />
              ) : monthly.data.every((m) => m.incomeMinor === 0 && m.expenseMinor === 0) ? (
                <p className="py-8 text-center text-fg-muted">{s.noActivity}</p>
              ) : (
                <MonthlyBars months={monthly.data} selected={month} onSelect={setMonth} money={money} />
              )}
            </Stale>
          </section>
        </Card>
      </div>
    </>
  );
}
