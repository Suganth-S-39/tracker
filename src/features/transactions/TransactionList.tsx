import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { Category } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { formatDayHeading, todayLocal } from '@/domain/dates';
import { strings } from '@/strings/en';
import type { Transaction } from './api';
import { TransactionRow } from './TransactionRow';

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
 */
export function TransactionList(props: TransactionListProps) {
  const { transactions, categories, money, hasMore, loadingMore, onLoadMore, onOpen, onDelete } = props;
  const today = todayLocal();

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
    estimateSize: (index) => (items[index]?.kind === 'header' ? 44 : 68),
    overscan: 10,
    scrollMargin,
    getItemKey: (index) => items[index]?.key ?? index,
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
                  onOpen={() => onOpen(item.transaction)}
                  onDelete={item.transaction.iou_id || !onDelete ? undefined : () => onDelete(item.transaction)}
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
