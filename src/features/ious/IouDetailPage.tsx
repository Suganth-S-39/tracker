import { ChevronLeft, Handshake, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useMoney } from '@/features/money/useMoney';
import { formatDate, todayLocal } from '@/domain/dates';
import { isOverdue } from '@/domain/iou';
import { formatMoney } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { usePageTitle } from '@/lib/usePageTitle';
import { strings } from '@/strings/en';
import { useDeleteIou, useDeleteRepayment, useIou, useRepayments, type Repayment } from './api';
import { IouForm } from './IouForm';
import { RepaymentForm } from './RepaymentForm';

const s = strings.ious;

type Dialog =
  | { kind: 'none' }
  | { kind: 'edit' }
  | { kind: 'repay'; repayment?: Repayment }
  | { kind: 'delete' }
  | { kind: 'deleteRepayment'; repayment: Repayment };

/** One IOU: balance, actions, and repayment history (spec section 8). */
export function IouDetailPage() {
  const { id = '' } = useParams();
  const iou = useIou(id);
  const repayments = useRepayments(id);
  const money = useMoney();
  const online = useOnlineStatus();
  const toast = useToast();
  const navigate = useNavigate();
  const deleteIou = useDeleteIou();
  const deleteRepayment = useDeleteRepayment();
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [dialogKey, setDialogKey] = useState(0);
  usePageTitle(iou.data?.person_name ?? strings.pages.ious.title);

  const open = (next: Dialog) => {
    setDialogKey((k) => k + 1);
    setDialog(next);
  };
  const close = () => setDialog({ kind: 'none' });

  const back = (
    <Link to="/ious" className="-ml-2 inline-flex h-10 items-center gap-1 rounded-control px-2 pt-safe text-sm font-semibold text-fg-muted hover:text-fg">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {s.back}
    </Link>
  );

  if (iou.isError && iou.data === undefined) return <>{back}<ErrorState error={iou.error} onRetry={() => void iou.refetch()} /></>;
  if (iou.isPending || !money) {
    return (
      <>
        {back}
        <Skeleton className="mt-4 h-64 rounded-card" />
      </>
    );
  }
  if (!iou.data) {
    return (
      <>
        {back}
        <Card className="mt-4">
          <EmptyState icon={Handshake} title={s.notFound} />
        </Card>
      </>
    );
  }

  const data = iou.data;
  const exponent = money.exponentOf(data.original_currency);
  const fmt = (minor: number) => formatMoney(minor, data.original_currency, exponent);
  const settled = data.status === 'settled';
  const repaidPercent = data.original_amount_minor > 0 ? (data.repaid_minor / data.original_amount_minor) * 100 : 0;
  const overdue = isOverdue(data.due_date, data.remaining_minor, todayLocal());

  return (
    <>
      {back}
      <div className="mt-2 grid gap-4 wide:grid-cols-2 wide:items-start">
        <Card className="p-6">
          <p className="text-sm font-medium text-fg-muted">
            {data.direction === 'lent' ? s.lentTo(data.person_name) : s.borrowedFrom(data.person_name)}
          </p>
          <h1 className="mt-1 text-[2rem] leading-tight font-bold">{data.person_name}</h1>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-fg-muted">{s.remaining}</p>
              <p className="font-display text-[2.25rem] leading-tight font-semibold tracking-tight tabular" data-testid="iou-remaining">
                {fmt(data.remaining_minor)}
              </p>
              <p className="text-sm text-fg-muted tabular">
                {s.remainingOf(fmt(data.original_amount_minor))} · {s.repaidSoFar(fmt(data.repaid_minor))}
              </p>
            </div>
            {settled ? <span className="rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent-strong">{s.settled}</span> : null}
          </div>

          <div aria-hidden="true" className="mt-4 h-2.5 overflow-hidden rounded-full bg-control">
            <div className="h-full rounded-full bg-accent" style={{ width: `${repaidPercent}%` }} />
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-fg-muted">{s.form.date}</dt>
              <dd className="font-medium">{formatDate(data.date)}</dd>
            </div>
            {data.due_date ? (
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">{s.form.dueDate}</dt>
                <dd className={overdue ? 'font-semibold text-expense-strong' : 'font-medium'}>
                  {formatDate(data.due_date)}
                  {overdue ? ` · ${s.overdue}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          {data.note ? <p className="mt-3 text-sm">{data.note}</p> : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => open({ kind: 'repay' })} disabled={settled || !online}>
              {s.recordRepayment}
            </Button>
            <Button variant="secondary" onClick={() => open({ kind: 'edit' })} disabled={!online} icon={<Pencil aria-hidden="true" className="size-4" />}>
              {s.edit}
            </Button>
            <Button variant="ghost" className="text-expense-strong" onClick={() => open({ kind: 'delete' })} disabled={!online} icon={<Trash2 aria-hidden="true" className="size-4" />}>
              {s.delete}
            </Button>
          </div>
        </Card>

        <Card className="p-2">
          <section aria-label={s.history}>
            <h2 className="px-3 pt-3 pb-1 text-xl font-bold">{s.history}</h2>
            {(repayments.isError && repayments.data === undefined) ? (
              <ErrorState error={repayments.error} onRetry={() => void repayments.refetch()} />
            ) : repayments.isPending ? (
              <Skeleton className="m-3 h-20" />
            ) : repayments.data.length === 0 ? (
              <p className="px-3 pb-4 text-sm text-fg-muted">{s.noRepayments}</p>
            ) : (
              <ul>
                {repayments.data.map((r) => {
                  const date = formatDate(r.date);
                  const foreign = r.currency !== data.original_currency;
                  return (
                    <li key={r.id} className="flex items-center gap-2 rounded-control px-3 py-2.5" data-testid="repayment">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold tabular">
                          {formatMoney(r.amount_minor, r.currency, money.exponentOf(r.currency))}
                          {foreign ? <span className="ml-1.5 font-normal text-fg-muted">{s.convertedTo(fmt(r.iou_currency_amount_minor))}</span> : null}
                        </span>
                        <span className="block truncate text-sm text-fg-muted">{[date, r.note].filter(Boolean).join(' · ')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => open({ kind: 'repay', repayment: r })}
                        disabled={!online}
                        aria-label={s.editRepaymentLabel(date)}
                        className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => open({ kind: 'deleteRepayment', repayment: r })}
                        disabled={!online}
                        aria-label={s.deleteRepaymentLabel(date)}
                        className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-expense-strong disabled:opacity-50"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Card>
      </div>

      <ResponsiveDialog
        open={dialog.kind === 'edit'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.form.editTitle}
        description={s.form.editDescription}
      >
        <IouForm key={dialogKey} money={money} iou={data} onClose={close} />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.kind === 'repay'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={dialog.kind === 'repay' && dialog.repayment ? s.repayment.editTitle : s.repayment.title}
        description={s.repayment.description(data.person_name, data.direction)}
      >
        {dialog.kind === 'repay' ? (
          <RepaymentForm key={dialogKey} iou={data} money={money} repayment={dialog.repayment} onClose={close} />
        ) : null}
      </ResponsiveDialog>

      <ConfirmDialog
        open={dialog.kind === 'delete'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.confirmDelete.title}
        body={s.confirmDelete.body}
        confirmLabel={s.confirmDelete.confirm}
        pending={deleteIou.isPending}
        onConfirm={() =>
          deleteIou.mutate(data.id, {
            onSuccess: () => {
              toast({ message: s.deleted });
              void navigate('/ious', { replace: true });
            },
            onError: (error) => toast({ message: errorMessage(error) }),
          })
        }
      />

      <ConfirmDialog
        open={dialog.kind === 'deleteRepayment'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.confirmDeleteRepayment.title}
        body={s.confirmDeleteRepayment.body}
        confirmLabel={s.confirmDeleteRepayment.confirm}
        pending={deleteRepayment.isPending}
        onConfirm={() => {
          if (dialog.kind !== 'deleteRepayment') return;
          deleteRepayment.mutate(dialog.repayment.id, {
            onSuccess: () => {
              toast({ message: s.repaymentDeleted });
              close();
            },
            onError: (error) => toast({ message: errorMessage(error) }),
          });
        }}
      />
    </>
  );
}
