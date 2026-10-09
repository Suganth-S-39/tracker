import { Repeat, Trash2 } from 'lucide-react';
import { memo, useRef, useState, type PointerEvent } from 'react';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { categoryLabel, type Category } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { formatMoney, formatSignedMoney } from '@/domain/money';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import type { Transaction } from './api';
import { AMOUNT_TEXT } from './kinds';

type TransactionRowProps = {
  transaction: Transaction;
  category: Category | undefined;
  money: MoneyContext;
  /** Pass a stable function (not a new closure per render) so unchanged rows skip re-rendering. */
  onOpen: (transaction: Transaction) => void;
  /** Omit to show the row without delete (e.g. on Home). Stable, like onOpen. */
  onDelete?: ((transaction: Transaction) => void) | undefined;
};

/** Every row is this tall (`min-h-16`), so the virtualized list's estimates are exact. */
export const TRANSACTION_ROW_HEIGHT = 64;

const SWIPE_DELETE_FRACTION = 0.35;
const DRAG_START_PX = 8;

/**
 * One transaction. Tap or click to edit. Phones: swipe left to delete. Wide screens: a delete
 * button on the row. Amounts carry a +/- sign so income and expense never rely on color alone.
 * Memoized: while the list scrolls, only rows whose data changed re-render.
 */
export const TransactionRow = memo(function TransactionRow({ transaction, category, money, onOpen, onDelete }: TransactionRowProps) {
  const label = category ? categoryLabel(category) : '';
  const title = transaction.payee ?? label;
  const subtitle = [transaction.payee ? label : null, transaction.note].filter(Boolean).join(' · ');
  const amount = formatSignedMoney(
    transaction.type,
    transaction.original_amount_minor,
    transaction.original_currency,
    money.exponentOf(transaction.original_currency),
  );
  const foreign = transaction.original_currency !== money.baseCurrency;
  const description = `${title}, ${amount}`;

  const swipe = useSwipeToDelete(onDelete ? () => onDelete(transaction) : undefined);

  return (
    <div className="group relative overflow-hidden rounded-control">
      {swipe.offset !== 0 ? (
        // Revealed behind the row only while swiping (so it never peeks through rounded corners).
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end bg-expense-strong pr-5 text-bg">
          <Trash2 className="size-5" />
        </div>
      ) : null}
      <div
        className={cx(
          'relative flex items-center gap-1',
          // Opaque only while sliding, to cover the delete layer; otherwise the glass shows through.
          swipe.offset !== 0 && 'bg-surface',
          swipe.dragging ? '' : 'transition-transform duration-200',
        )}
        style={{ transform: `translateX(${swipe.offset}px)`, touchAction: onDelete ? 'pan-y' : undefined }}
        {...swipe.handlers}
      >
        <button
          type="button"
          onClick={(e) => (swipe.consumeClick() ? e.preventDefault() : onOpen(transaction))}
          aria-label={strings.transactions.openLabel(description)}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-hover"
        >
          <CategoryIcon icon={category?.icon ?? 'tag'} tone={transaction.type} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="truncate">{title}</span>
              {transaction.recurring_rule_id ? (
                <Repeat aria-label={strings.recurring.recurringLabel} role="img" className="size-3.5 shrink-0 text-fg-muted" />
              ) : null}
            </span>
            {subtitle ? <span className="block truncate text-sm text-fg-muted">{subtitle}</span> : null}
          </span>
          <span className="shrink-0 text-right">
            <span className={cx('block font-bold tabular', AMOUNT_TEXT[transaction.type])}>{amount}</span>
            {transaction.type === 'savings' || transaction.type === 'investment' ? (
              <span className="block text-xs font-semibold text-fg-muted">{strings.transactions.kindTag[transaction.type]}</span>
            ) : null}
            {foreign ? (
              <span className="block text-xs text-fg-muted tabular">
                {strings.transactions.convertedApprox(
                  formatMoney(transaction.base_amount_minor, money.baseCurrency, money.exponentOf(money.baseCurrency)),
                )}
              </span>
            ) : null}
            {transaction.iou_id ? (
              <span className="block text-xs font-semibold text-fg-muted">{strings.transactions.iou}</span>
            ) : null}
          </span>
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(transaction)}
            aria-label={strings.transactions.deleteLabel(description)}
            className="hidden size-10 shrink-0 place-items-center rounded-full text-fg-muted opacity-60 group-hover:opacity-100 hover:bg-hover hover:text-expense-strong focus-visible:opacity-100 wide:grid"
          >
            <Trash2 aria-hidden="true" className="size-4.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

/** Horizontal swipe to the left past a threshold deletes; vertical movement scrolls as usual. */
function useSwipeToDelete(onDelete: (() => void) | undefined) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; width: number; id: number } | null>(null);
  const moved = useRef(false);

  if (!onDelete) {
    return { offset: 0, dragging: false, handlers: {}, consumeClick: () => false };
  }

  function end(commit: boolean) {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (commit && s) {
      setOffset(-s.width);
      // Let the slide-out finish, then delete. If the row is still here afterwards (the delete
      // failed), slide it back.
      window.setTimeout(() => {
        onDelete?.();
        setOffset(0);
      }, 180);
    } else {
      setOffset(0);
    }
  }

  return {
    offset,
    dragging,
    consumeClick: () => {
      const wasDrag = moved.current;
      moved.current = false;
      return wasDrag;
    },
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, width: e.currentTarget.offsetWidth, id: e.pointerId };
        moved.current = false;
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!moved.current) {
          if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy)) {
            if (Math.abs(dy) > DRAG_START_PX) start.current = null; // a vertical scroll
            return;
          }
          moved.current = true;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        setOffset(Math.min(0, dx));
      },
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
        const s = start.current;
        if (!s || !moved.current) {
          start.current = null;
          return;
        }
        end(e.clientX - s.x < -s.width * SWIPE_DELETE_FRACTION);
      },
      onPointerCancel: () => end(false),
    },
  };
}
