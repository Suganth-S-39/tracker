import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { Category } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { formatDayHeading, todayLocal } from '@/domain/dates';
import { strings } from '@/strings/en';
import type { Transaction } from './api';
import { TRANSACTION_ROW_HEIGHT, TransactionRow } from './TransactionRow';

/** A day heading's rendered height (pt-4 + pb-1.5 + one 20px line), so estimates are exact. */
const DAY_HEADING_HEIGHT = 42;

type Item =
  | { kind: 'header'; key: string; date: string }
  | { kind: 'row'; key: string; transaction: Transaction };

type TransactionListProps = {
  transactions: readonly Transaction[];
  categories: ReadonlyMap<string, Category>;
  money: MoneyContext;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (transaction: Transaction) => void;
  /** Omit while offline: deleting is a write. */
  onDelete?: ((transaction: Transaction) => void) | undefined;
};

/**
 * Transactions grouped by day. Virtualized against the window scroll, so a few thousand rows
 * stay smooth: only the rows on screen (plus a margin) are in the DOM.
 *
 * Scrolling re-renders this list as rows enter and leave, so the per-scroll work is kept small:
 * rows are memoized and get stable handlers, size estimates match the real heights (no scroll
 * corrections while scrolling up), and renders aren't forced synchronously on every scroll event.
 */
export function TransactionList(props: TransactionListProps) {
  const { transactions, categories, money, hasMore, loadingMore, onLoadMore, onOpen, onDelete } = props;
  const today = todayLocal();

  // Stable handlers that always call the latest props, so memoized rows don't re-render when
  // the parent passes new functions.
  const handlers = useRef({ onOpen, onDelete });
  useLayoutEffect(() => {
    handlers.current = { onOpen, onDelete };
  });
  const open = useCallback((transaction: Transaction) => handlers.current.onOpen(transaction), []);
  const remove = useCallback((transaction: Transaction) => handlers.current.onDelete?.(transaction), []);
  const canDelete = onDelete !== undefined;

  const items = useMemo(() => {
    const result: Item[] = [];
    let currentDate: string | null = null;
    for (const transaction of transactions) {
      if (transaction.date !== currentDate) {
        currentDate = transaction.date;
        result.push({ kind: 'header', key: `h-${currentDate}`, date: currentDate });
      }
      result.push({ kind: 'row', key: transaction.id, transaction });
    }
    return result;
  }, [transactions]);

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) => (items[index]?.kind === 'header' ? DAY_HEADING_HEIGHT : TRANSACTION_ROW_HEIGHT),
    overscan: 10,
    scrollMargin,
    getItemKey: (index) => items[index]?.key ?? index,
    // Let React batch scroll renders instead of flushing synchronously on every scroll event.
    useFlushSync: false,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // Load the next page as the end of the list comes into view.
  const lastVisible = virtualItems.at(-1)?.index ?? 0;
  useEffect(() => {
    if (hasMore && !loadingMore && lastVisible >= items.length - 15) onLoadMore();
  }, [hasMore, loadingMore, lastVisible, items.length, onLoadMore]);

  return (
    <div ref={listRef}>
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualItem.start - scrollMargin}px)` }}
            >
              {item.kind === 'header' ? (
                <h2 className="px-2 pt-4 pb-1.5 text-sm font-semibold text-fg-muted">
                  {formatDayHeading(item.date, today, strings.transactions)}
                </h2>
              ) : (
                <TransactionRow
                  transaction={item.transaction}
                  category={categories.get(item.transaction.category_id)}
                  money={money}
                  onOpen={open}
                  onDelete={item.transaction.iou_id || !canDelete ? undefined : remove}
                />
              )}
            </div>
          );
        })}
      </div>
      {loadingMore ? (
        <div role="status" className="flex justify-center py-4 text-fg-muted">
          <Spinner size="sm" />
          <span className="sr-only">{strings.transactions.loadingMore}</span>
        </div>
      ) : null}
    </div>
  );
}
