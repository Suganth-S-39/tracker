import { Pencil, PiggyBank, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { categoryLabel, useCategories, useCategoryMap } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { MonthSelector } from '@/features/month/MonthSelector';
import { useSelectedMonth } from '@/features/month/month-context';
import { formatMonth, formatMonthShort } from '@/domain/dates';
import { strings } from '@/strings/en';
import { useBudgetStatus } from './api';
import { BudgetEditor, type BudgetEditorTarget } from './BudgetEditor';
import { BudgetMeter } from './BudgetMeter';

const s = strings.budgets;

/** Budgets page (spec section 8): the overall monthly budget, then optional category budgets. */
export function BudgetsPage() {
  const { month } = useSelectedMonth();
  const money = useMoney();
  const status = useBudgetStatus(month);
  const categories = useCategories();
  const categoryMap = useCategoryMap();
  const [editor, setEditor] = useState<{ open: boolean; target: BudgetEditorTarget; key: number }>({
    open: false,
    target: { kind: 'overall' },
    key: 0,
  });

  const open = (target: BudgetEditorTarget) => setEditor((e) => ({ open: true, target, key: e.key + 1 }));
  const close = () => setEditor((e) => ({ ...e, open: false }));

  const overall = status.data?.find((b) => b.categoryId === null);
  const categoryBudgets = useMemo(
    () =>
      (status.data ?? [])
        .filter((b) => b.categoryId !== null)
        .sort((a, b) => b.spentMinor / b.amountMinor - a.spentMinor / a.amountMinor), // most used first
    [status.data],
  );
  const budgeted = new Set(categoryBudgets.map((b) => b.categoryId));
  const available = (categories.data ?? []).filter(
    (c) => c.kind === 'expense' && !c.is_system && !c.is_hidden && !budgeted.has(c.id),
  );
  const nameOf = (id: string) => {
    const category = categoryMap.get(id);
    return category ? categoryLabel(category) : '';
  };
  const monthName = formatMonth(month);

  let body;
  if (status.isError && status.data === undefined) {
    body = (
      <Card>
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      </Card>
    );
  } else if (status.isPending || !money) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-36 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  } else if (!overall && categoryBudgets.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon={PiggyBank}
          title={s.emptyTitle(monthName)}
          body={s.emptyBody}
          action={
            <Button onClick={() => open({ kind: 'overall' })} icon={<Plus aria-hidden="true" className="size-4" />}>
              {s.setOverall}
            </Button>
          }
        />
      </Card>
    );
  } else {
    body = (
      <div className="grid gap-4 wide:grid-cols-2 wide:items-start">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{s.overall}</h2>
            {overall ? (
              <button
                type="button"
                onClick={() => open({ kind: 'overall', amountMinor: overall.amountMinor })}
                aria-label={s.editOverallLabel}
                className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
              >
                <Pencil aria-hidden="true" className="size-4.5" />
              </button>
            ) : null}
          </div>
          {overall ? (
            <>
              <BudgetMeter label={monthName} spentMinor={overall.spentMinor} budgetMinor={overall.amountMinor} money={money} />
              {overall.setForMonth !== month ? (
                <p className="mt-3 text-xs text-fg-muted">{s.since(formatMonthShort(overall.setForMonth))}</p>
              ) : null}
            </>
          ) : (
            <Button variant="secondary" onClick={() => open({ kind: 'overall' })} icon={<Plus aria-hidden="true" className="size-4" />}>
              {s.setOverall}
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{s.categoryBudgets}</h2>
          </div>
          {categoryBudgets.length === 0 ? <p className="mb-4 text-sm text-fg-muted">{s.noCategoryBudgets}</p> : null}
          <ul className="flex flex-col">
            {categoryBudgets.map((budget) => {
              const id = budget.categoryId ?? '';
              const category = categoryMap.get(id);
              return (
                <li key={id} className="flex items-start gap-3 border-b border-divider py-4 last:border-b-0">
                  <CategoryIcon icon={category?.icon ?? 'tag'} tone="expense" />
                  <div className="min-w-0 flex-1">
                    <BudgetMeter label={nameOf(id)} spentMinor={budget.spentMinor} budgetMinor={budget.amountMinor} money={money} />
                  </div>
                  <button
                    type="button"
                    onClick={() => open({ kind: 'category', categoryId: id, amountMinor: budget.amountMinor })}
                    aria-label={s.editLabel(nameOf(id))}
                    className="-mt-1.5 grid size-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
                  >
                    <Pencil aria-hidden="true" className="size-4.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {available.length > 0 ? (
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => open({ kind: 'category' })}
              icon={<Plus aria-hidden="true" className="size-4" />}
            >
              {s.addCategory}
            </Button>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">{s.allCategoriesBudgeted}</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={strings.pages.budgets.title} actions={<MonthSelector />} />
      <p className="mb-4 text-sm text-fg-muted">{s.carryHint}</p>
      <Stale stale={status.isPlaceholderData}>{body}</Stale>

      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(next) => (next ? undefined : close())}
        title={editor.target.kind === 'overall' ? s.editor.overallTitle : s.editor.categoryTitle}
        description={s.editor.description(monthName)}
      >
        {money ? (
          <BudgetEditor
            key={editor.key}
            target={editor.target}
            month={month}
            money={money}
            availableCategories={available}
            categoryName={nameOf}
            onDone={close}
          />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}
