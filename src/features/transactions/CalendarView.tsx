import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stale } from '@/components/ui/Stale';
import { useCategoryMap } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { MonthSelector } from '@/features/month/MonthSelector';
import { useSelectedMonth } from '@/features/month/month-context';
import { monthGrid, moveWithinMonth, sampleDateFor, spendLevel, weekdayOrder, type Weekday } from '@/domain/calendar';
import {
  addMonths,
  formatDayHeading,
  formatDayLong,
  formatMonth,
  formatWeekday,
  monthOf,
  monthRange,
  todayLocal,
  type IsoDate,
} from '@/domain/dates';
import { formatAmountTiny, formatMoney } from '@/domain/money';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { useDailyTotals, useTransactionPages, type DayTotals, type Transaction } from './api';
import { isGoalManaged } from './kinds';
import { TransactionRow } from './TransactionRow';

const c = strings.transactions.calendar;

/** The week's first day from the browser's locale (Sunday in the US, Monday in most of Europe). */
function localeFirstDay(): Weekday {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    if (firstDay && firstDay >= 1 && firstDay <= 7) return firstDay as Weekday;
  } catch {
    // Older browsers: fall through to Monday.
  }
  return 1;
}

const FIRST_DAY = localeFirstDay();

/** Day tint by spending (0-4), relative to the month's biggest day. Always paired with the amount in text. */
const LEVEL_CLASS = ['', 'bg-expense/10', 'bg-expense/18', 'bg-expense/26', 'bg-expense/34'] as const;

const ARROW_MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

type CalendarViewProps = {
  money: MoneyContext;
  /** Stable functions (see TransactionRow). */
  onOpen: (transaction: Transaction) => void;
  onDelete?: ((transaction: Transaction) => void) | undefined;
};

/**
 * The Transactions page's calendar (owner request, 2026-10-10): each day of the selected month
 * with what was spent (tinted by how much), and the chosen day's transactions below (beside it
 * on wide screens). Days are buttons with full spoken labels; arrow keys move by day and week,
 * Page Up/Down by month.
 */
export function CalendarView({ money, onOpen, onDelete }: CalendarViewProps) {
  const { month, setMonth } = useSelectedMonth();
  const today = todayLocal();
  const totals = useDailyTotals(month);
  const headingId = useId();

  const [picked, setPicked] = useState<IsoDate | null>(null);
  const selected = picked && monthOf(picked) === month ? picked : monthOf(today) === month ? today : monthRange(month).first;
  const focusAfterMove = useRef(false);

  const weeks = useMemo(() => monthGrid(month, FIRST_DAY), [month]);
  const byDay = useMemo(() => new Map((totals.data ?? []).map((d) => [d.day, d])), [totals.data]);
  const maxExpense = useMemo(() => Math.max(0, ...(totals.data ?? []).map((d) => d.expenseMinor)), [totals.data]);
  const monthSpent = useMemo(() => (totals.data ?? []).reduce((sum, d) => sum + d.expenseMinor, 0), [totals.data]);

  const base = money.baseCurrency;
  const exponent = money.exponentOf(base);
  const full = (minor: number) => formatMoney(minor, base, exponent);

  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    document.getElementById(`day-${selected}`)?.focus();
  }, [selected]);

  function moveTo(date: IsoDate) {
    focusAfterMove.current = true;
    setPicked(date);
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: IsoDate) {
    const delta = ARROW_MOVES[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveTo(moveWithinMonth(date, delta, month));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const { first, last } = monthRange(month);
      moveTo(event.key === 'Home' ? first : last);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const next = addMonths(month, event.key === 'PageUp' ? -1 : 1);
      const { last } = monthRange(next);
      const sameDay = `${next}-${date.slice(8)}`;
      setMonth(next);
      moveTo(sameDay > last ? last : sameDay);
    }
  }

  function dayLabel(date: IsoDate, day: DayTotals | undefined) {
    const parts: string[] = [];
    if (day?.expenseMinor) parts.push(c.spent(full(day.expenseMinor)));
    if (day?.incomeMinor) parts.push(c.received(full(day.incomeMinor)));
    if (day?.count) parts.push(c.count(day.count));
    const name = date === today ? `${formatDayLong(date)}, ${c.today}` : formatDayLong(date);
    return c.day(name, parts.length ? parts.join(', ') : c.nothing);
  }

  return (
    <div className="grid gap-4 wide:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] wide:items-start">
      <Card className="p-3 wide:p-5">
        <section aria-labelledby={headingId}>
          <h2 id={headingId} className="sr-only">
            {c.heading(formatMonth(month))}
          </h2>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <MonthSelector />
            {totals.data ? (
              <p className="text-sm font-semibold text-fg-muted tabular">{c.monthSpent(full(monthSpent))}</p>
            ) : null}
          </div>

          {totals.isError && totals.data === undefined ? (
            <ErrorState error={totals.error} onRetry={() => void totals.refetch()} />
          ) : (
            <Stale stale={totals.isPlaceholderData}>
              <table className="w-full table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    {weekdayOrder(FIRST_DAY).map((weekday) => {
                      const sample = sampleDateFor(weekday);
                      return (
                        <th key={weekday} scope="col" abbr={formatWeekday(sample, 'long')} className="pb-1 text-xs font-medium text-fg-muted">
                          {formatWeekday(sample, 'short')}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.find(Boolean) ?? 'empty'}>
                      {week.map((date, index) => {
                        if (!date) return <td key={`blank-${index}`} />;
                        const day = byDay.get(date);
                        const isSelected = date === selected;
                        const isToday = date === today;
                        const expense = day?.expenseMinor ?? 0;
                        const income = day?.incomeMinor ?? 0;
                        return (
                          <td key={date} className="p-0">
                            <button
                              type="button"
                              id={`day-${date}`}
                              tabIndex={isSelected ? 0 : -1}
                              aria-pressed={isSelected}
                              aria-label={dayLabel(date, day)}
                              onClick={() => setPicked(date)}
                              onKeyDown={(event) => onDayKeyDown(event, date)}
                              className={cx(
                                'flex h-14 w-full flex-col items-center rounded-xl pt-1.5 text-sm transition-colors wide:h-[4.5rem]',
                                isSelected
                                  ? 'bg-accent-strong text-on-accent'
                                  : cx(LEVEL_CLASS[spendLevel(expense, maxExpense)], 'hover:bg-hover'),
                                isToday && !isSelected && 'ring-2 ring-accent ring-inset',
                              )}
                            >
                              <span aria-hidden="true" className={cx('tabular', isToday ? 'font-bold' : 'font-medium')}>
                                {Number(date.slice(8))}
                              </span>
                              {expense > 0 ? (
                                <span aria-hidden="true" className="mt-0.5 max-w-full truncate px-0.5 text-[0.6875rem] font-semibold tabular">
                                  {`−${formatAmountTiny(expense, exponent)}`}
                                </span>
                              ) : income > 0 ? (
                                <span aria-hidden="true" className="mt-0.5 max-w-full truncate px-0.5 text-[0.6875rem] font-semibold tabular">
                                  {`+${formatAmountTiny(income, exponent)}`}
                                </span>
                              ) : day?.count ? (
                                // Activity without spending or income (savings, investments): a dot.
                                <span aria-hidden="true" className="mt-1.5 size-1.5 rounded-full bg-current opacity-60" />
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Stale>
          )}
        </section>
      </Card>

      <DayTransactions day={selected} today={today} totals={byDay.get(selected)} money={money} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

/** The chosen day's transactions (a day rarely has more than one page of 50). */
function DayTransactions({
  day,
  today,
  totals,
  money,
  onOpen,
  onDelete,
}: {
  day: IsoDate;
  today: IsoDate;
  totals: DayTotals | undefined;
  money: MoneyContext;
  onOpen: (transaction: Transaction) => void;
  onDelete?: ((transaction: Transaction) => void) | undefined;
}) {
  const filters = useMemo(() => ({ from: day, to: day }), [day]);
  const pages = useTransactionPages(filters);
  const categories = useCategoryMap();
  const transactions = pages.data?.pages.flat() ?? [];
  const headingId = useId();
  const base = money.baseCurrency;
  const full = (minor: number) => formatMoney(minor, base, money.exponentOf(base));

  return (
    <Card className="p-2">
      <section aria-labelledby={headingId}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 pt-3 pb-1">
          <h2 id={headingId} className="text-lg font-bold">
            {formatDayHeading(day, today, strings.transactions)}
          </h2>
          {totals && (totals.expenseMinor > 0 || totals.incomeMinor > 0) ? (
            <p className="text-sm text-fg-muted tabular">
              {[
                totals.expenseMinor > 0 ? `${c.spentLabel} ${full(totals.expenseMinor)}` : null,
                totals.incomeMinor > 0 ? `${c.receivedLabel} ${full(totals.incomeMinor)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        {pages.isError && pages.data === undefined ? (
          <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />
        ) : pages.isPending ? (
          <div className="flex flex-col gap-3 p-3" aria-busy="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="px-3 pt-1 pb-4 text-sm text-fg-muted">{c.emptyDay}</p>
        ) : (
          <Stale stale={pages.isPlaceholderData}>
            <div className="flex flex-col gap-0.5 pb-1">
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={categories.get(transaction.category_id)}
                  money={money}
                  onOpen={onOpen}
                  onDelete={transaction.iou_id || isGoalManaged(transaction) ? undefined : onDelete}
                />
              ))}
            </div>
          </Stale>
        )}
      </section>
    </Card>
  );
}
