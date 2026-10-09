import { ChevronRight, Handshake, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoney, type MoneyContext } from '@/features/money/useMoney';
import { useTransactionEditor } from '@/features/transactions/editor-context';
import { formatDate, todayLocal } from '@/domain/dates';
import { isOverdue } from '@/domain/iou';
import { formatMoney } from '@/domain/money';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { useIous, type Iou } from './api';

const s = strings.ious;

function IouRow({ iou, money }: { iou: Iou; money: MoneyContext }) {
  const exponent = money.exponentOf(iou.original_currency);
  const remaining = formatMoney(iou.remaining_minor, iou.original_currency, exponent);
  const settled = iou.status === 'settled';
  const overdue = isOverdue(iou.due_date, iou.remaining_minor, todayLocal());

  return (
    <li>
      <Link
        to={`/ious/${iou.id}`}
        aria-label={settled ? s.settledLabel(iou.person_name) : s.openLabel(iou.person_name, remaining)}
        className="flex items-center gap-3 rounded-control px-3 py-3 hover:bg-hover"
      >
        <span
          aria-hidden="true"
          className={cx(
            'grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold',
            settled ? 'bg-control text-fg-muted' : iou.direction === 'lent' ? 'bg-income-tint text-income-strong' : 'bg-expense-tint text-expense-strong',
          )}
        >
          {iou.person_name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-semibold', settled && 'text-fg-muted')}>{iou.person_name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
            <span>{s.since(formatDate(iou.date))}</span>
            {iou.due_date && !settled ? <span>{s.due(formatDate(iou.due_date))}</span> : null}
            {overdue ? <span className="font-semibold text-expense-strong">{s.overdue}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {settled ? (
            <span className="rounded-full bg-control px-2.5 py-1 text-xs font-semibold text-fg-muted">{s.settled}</span>
          ) : (
            <>
              <span className="block font-bold tabular">{remaining}</span>
              <span className="block text-xs text-fg-muted tabular">
                {s.remainingOf(formatMoney(iou.original_amount_minor, iou.original_currency, exponent))}
              </span>
            </>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      </Link>
    </li>
  );
}

/** IOU page (spec section 8): owed to you and owed by you, open first, settled after. */
export function IousPage() {
  const ious = useIous();
  const money = useMoney();
  const editor = useTransactionEditor();
  const addButton = (
    <Button onClick={() => editor.openCreate('iou')} icon={<Plus aria-hidden="true" className="size-4" />}>
      {s.add}
    </Button>
  );

  let body;
  if (ious.isError && ious.data === undefined) {
    body = (
      <Card>
        <ErrorState error={ious.error} onRetry={() => void ious.refetch()} />
      </Card>
    );
  } else if (ious.isPending || !money) {
    body = <Skeleton className="h-64 rounded-card" />;
  } else if (ious.data.length === 0) {
    body = (
      <Card>
        <EmptyState icon={Handshake} title={s.emptyTitle} body={s.emptyBody} action={addButton} />
      </Card>
    );
  } else {
    body = (
      <div className="grid gap-4 wide:grid-cols-2 wide:items-start">
        {(
          [
            ['lent', s.owedToYou],
            ['borrowed', s.youOwe],
          ] as const
        ).map(([direction, title]) => {
          const list = ious.data.filter((i) => i.direction === direction);
          return (
            <Card key={direction} className="p-2">
              <section aria-label={title}>
                <h2 className="px-3 pt-3 pb-1 text-xl font-bold">{title}</h2>
                {list.length === 0 ? (
                  <p className="px-3 pb-4 text-sm text-fg-muted">{s.emptySection}</p>
                ) : (
                  <ul>
                    {list.map((iou) => (
                      <IouRow key={iou.id} iou={iou} money={money} />
                    ))}
                  </ul>
                )}
              </section>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader title={strings.pages.ious.title} actions={ious.data?.length ? addButton : undefined} />
      <div className="mt-2">{body}</div>
    </>
  );
}
