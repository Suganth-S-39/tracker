import { Plus, ReceiptText, Search, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TextField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { categoryLabel, useCategories, useCategoryMap } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { cx } from '@/lib/cx';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useTransactionPages } from './api';
import { useTransactionEditor } from './editor-context';
import { EMPTY_FILTERS, hasActiveFilters, toQueryFilters, type DatePreset, type FilterState } from './filters';
import { TransactionList } from './TransactionList';
import { useDeleteWithUndo } from './useDeleteWithUndo';

const f = strings.transactions.filters;

const SEARCH_DEBOUNCE_MS = 250;

/** A native select styled as a filter chip: accessible and uses the phone's own picker. */
function FilterSelect({
  label,
  active,
  value,
  onChange,
  children,
}: {
  label: string;
  active: boolean;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-9 shrink-0 cursor-pointer appearance-none rounded-full px-3.5 text-sm font-medium',
        active ? 'bg-accent-strong text-on-accent' : 'bg-control text-fg',
      )}
    >
      {children}
    </select>
  );
}

export function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState('');
  const money = useMoney();
  const categories = useCategories();
  const categoryMap = useCategoryMap();
  const editor = useTransactionEditor();
  const deleteWithUndo = useDeleteWithUndo();
  const online = useOnlineStatus();

  // Search runs after a short pause in typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => ({ ...current, search: searchText })), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const queryFilters = useMemo(() => toQueryFilters(filters), [filters]);
  const pages = useTransactionPages(queryFilters);
  const transactions = useMemo(() => pages.data?.pages.flat() ?? [], [pages.data]);
  const filtered = hasActiveFilters(filters);

  function update(changes: Partial<FilterState>) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  function clearFilters() {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
  }

  const expenseCategories = (categories.data ?? []).filter((c) => c.kind === 'expense');
  const incomeCategories = (categories.data ?? []).filter((c) => c.kind === 'income');

  return (
    <>
      <PageHeader title={strings.pages.transactions.title} />

      {/* A floating frosted panel that stays put while the list scrolls under it. */}
      <div className="glass sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 mt-2 rounded-card p-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            aria-label={strings.transactions.searchLabel}
            placeholder={strings.transactions.searchLabel}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="block h-12 w-full rounded-control border border-control-border bg-surface pr-3.5 pl-11 text-base placeholder:text-fg-muted"
          />
        </div>

        <div role="group" aria-label={f.label} className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <FilterSelect label={f.type} active={filters.type !== ''} value={filters.type} onChange={(v) => update({ type: v as FilterState['type'] })}>
            <option value="">{f.allTypes}</option>
            <option value="expense">{strings.form.kinds.expense}</option>
            <option value="income">{strings.form.kinds.income}</option>
          </FilterSelect>

          <FilterSelect label={f.category} active={filters.categoryId !== ''} value={filters.categoryId} onChange={(v) => update({ categoryId: v })}>
            <option value="">{f.allCategories}</option>
            <optgroup label={strings.categories.sections.expense}>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </optgroup>
            <optgroup label={strings.categories.sections.income}>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </optgroup>
          </FilterSelect>

          <FilterSelect
            label={f.date}
            active={filters.datePreset !== 'all'}
            value={filters.datePreset}
            onChange={(v) => update({ datePreset: v as DatePreset })}
          >
            <option value="all">{f.allTime}</option>
            <option value="thisMonth">{f.thisMonth}</option>
            <option value="lastMonth">{f.lastMonth}</option>
            <option value="last3Months">{f.last3Months}</option>
            <option value="custom">{f.custom}</option>
          </FilterSelect>

          {filtered ? (
            <button type="button" onClick={clearFilters} className="h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-accent-strong hover:bg-hover">
              {strings.transactions.clearFilters}
            </button>
          ) : null}
        </div>

        {filters.datePreset === 'custom' ? (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <TextField label={f.from} type="date" value={filters.customFrom} onChange={(e) => update({ customFrom: e.target.value })} />
            <TextField label={f.to} type="date" value={filters.customTo} onChange={(e) => update({ customTo: e.target.value })} />
          </div>
        ) : null}
      </div>

      <Card className="mt-1 p-2">
        {pages.isPending || !money ? (
          <div className="flex flex-col gap-2 p-1" aria-busy="true">
            <Skeleton className="mt-2 h-4 w-24" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-2 h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (pages.isError && pages.data === undefined) ? (
          <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />
        ) : transactions.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title={strings.transactions.noResultsTitle}
              body={strings.transactions.noResultsBody}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {strings.transactions.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={strings.transactions.emptyTitle}
              body={strings.transactions.emptyBody}
              action={
                <Button onClick={() => editor.openCreate()} icon={<Plus aria-hidden="true" className="size-4" />}>
                  {strings.nav.addLong}
                </Button>
              }
            />
          )
        ) : (
          <TransactionList
            transactions={transactions}
            categories={categoryMap}
            money={money}
            hasMore={pages.hasNextPage}
            loadingMore={pages.isFetchingNextPage}
            onLoadMore={() => void pages.fetchNextPage()}
            onOpen={editor.openEdit}
            onDelete={online ? deleteWithUndo : undefined}
          />
        )}
      </Card>
    </>
  );
}
