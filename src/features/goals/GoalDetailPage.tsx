import { Pencil, Target, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/layout/BackButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useCategories, useCategoryMap } from '@/features/categories/api';
import { useMoney, type MoneyContext } from '@/features/money/useMoney';
import { useTransactionPages, type Transaction } from '@/features/transactions/api';
import { useTransactionEditor } from '@/features/transactions/editor-context';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { useDeleteWithUndo } from '@/features/transactions/useDeleteWithUndo';
import { formatDate, formatDayHeading, todayLocal } from '@/domain/dates';
import { goalPaceWeeks, goalPlan, goalProgress, weeksAsDuration, type GoalPlan } from '@/domain/goals';
import { formatMoney } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { usePageTitle } from '@/lib/usePageTitle';
import { strings } from '@/strings/en';
import { useGoalPhotos, useGoals, useReopenGoal, useSetGoalDeleted, useSetWithdrawalDeleted, type Goal } from './api';
import { BoughtForm } from './BoughtForm';
import { Celebration } from './Celebration';
import { GoalForm } from './GoalForm';
import { GoalBadge, GoalRing } from './GoalVisuals';
import { TakeOutForm } from './TakeOutForm';

const s = strings.goals;

/** How long the confetti stays (its animation is 950 ms). */
const CELEBRATION_MS = 1200;

type Dialog =
  | { kind: 'none' }
  | { kind: 'edit' }
  | { kind: 'takeOut' }
  | { kind: 'bought' }
  | { kind: 'delete' }
  | { kind: 'reopen' }
  | { kind: 'deleteWithdrawal'; transaction: Transaction };

function duration(weeks: number): string {
  const { unit, count } = weeksAsDuration(weeks);
  return s.duration[unit](count);
}

/** The "save this much a week" and "at your recent pace" lines for an open goal. */
function hints(goal: Goal, plan: GoalPlan, paceWeeks: number | null, fmt: (minor: number) => string): string[] {
  const lines: string[] = [];
  if (plan.kind === 'reached') return [s.plan.reached];
  if (plan.kind === 'weekly' && goal.target_date) {
    lines.push(plan.weeks === 1 ? s.plan.thisWeek(fmt(plan.perWeekMinor)) : s.plan.weekly(fmt(plan.perWeekMinor), formatDate(goal.target_date)));
  }
  if (plan.kind === 'late' && goal.target_date) lines.push(s.plan.late(formatDate(goal.target_date)));
  if (paceWeeks === null) lines.push(s.pace.none);
  else if (plan.kind === 'weekly' && paceWeeks <= plan.weeks) lines.push(s.pace.onTrack(duration(paceWeeks)));
  else lines.push(s.pace.estimate(duration(paceWeeks)));
  return lines;
}

/** One goal (owner request, 2026-10-10): progress, what to do next, and its money in and out. */
export function GoalDetailPage() {
  const { id = '' } = useParams();
  const goals = useGoals();
  const goal = goals.data?.find((g) => g.id === id);
  const photos = useGoalPhotos(goals.data);
  const money = useMoney();
  const categories = useCategories();
  const online = useOnlineStatus();
  const toast = useToast();
  const navigate = useNavigate();
  const editor = useTransactionEditor();
  const setDeleted = useSetGoalDeleted();
  const reopen = useReopenGoal();
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [dialogKey, setDialogKey] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  usePageTitle(goal?.name ?? strings.pages.goals.title);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  const open = useCallback((next: Dialog) => {
    setDialogKey((k) => k + 1);
    setDialog(next);
  }, []);
  const close = () => setDialog({ kind: 'none' });

  const back = <BackButton fallback="/goals" label={s.back} />;

  if (goals.isError && goals.data === undefined) {
    return (
      <>
        {back}
        <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
      </>
    );
  }
  if (goals.isPending || !money) {
    return (
      <>
        {back}
        <Skeleton className="mt-4 h-80 rounded-card" />
      </>
    );
  }
  if (!goal) {
    return (
      <>
        {back}
        <Card className="mt-4">
          <EmptyState icon={Target} title={s.notFound} />
        </Card>
      </>
    );
  }

  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  const today = todayLocal();
  const bought = goal.bought_on !== null;
  const progress = goalProgress(goal.saved_minor, goal.target_minor);
  const plan = goalPlan({ savedMinor: goal.saved_minor, targetMinor: goal.target_minor, targetDate: goal.target_date, today, exponent });
  const paceWeeks = goalPaceWeeks({
    remainingMinor: progress.remainingMinor,
    recentNetMinor: goal.recent_net_minor,
    firstAddedOn: goal.first_added_on,
    today,
  });
  const photo = photos.data?.[goal.id];

  function deleteGoal() {
    if (!goal) return;
    const goalId = goal.id;
    setDeleted.mutate(
      { id: goalId, deleted: true },
      {
        onSuccess: () => {
          toast({
            message: s.deleted,
            action: { label: strings.transactions.undo, onAction: () => setDeleted.mutate({ id: goalId, deleted: false }) },
          });
          void navigate('/goals', { replace: true });
        },
        onError: (error) => toast({ message: errorMessage(error) }),
      },
    );
  }

  return (
    <>
      {back}
      <div className="mt-2 grid gap-4 wide:grid-cols-2 wide:items-start">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <GoalBadge icon={goal.icon} photo={photo} bought={bought} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[1.75rem] leading-tight font-bold break-words">{goal.name}</h1>
              <p className="mt-0.5 text-sm text-fg-muted">
                {bought ? s.boughtFor(fmt(goal.spent_minor), formatDate(goal.bought_on ?? '')) : goal.target_date ? s.by(formatDate(goal.target_date)) : null}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {bought ? null : (
                <button
                  type="button"
                  onClick={() => open({ kind: 'edit' })}
                  disabled={!online}
                  aria-label={s.edit}
                  className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => open({ kind: 'delete' })}
                disabled={!online}
                aria-label={s.delete}
                className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-expense-strong disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-5">
            <div className="relative">
              <GoalRing fraction={bought ? 1 : progress.fraction} label={s.percent(bought ? 100 : progress.percent)} />
              {celebrating ? <Celebration /> : null}
            </div>
            <div className="min-w-0">
              {bought ? (
                <p className="text-lg font-bold">{s.celebration}</p>
              ) : (
                <>
                  <p className="font-display text-[2rem] leading-tight font-semibold tracking-tight tabular" data-testid="goal-saved">
                    {fmt(goal.saved_minor)}
                  </p>
                  <p className="text-sm text-fg-muted tabular">{s.ofTarget(fmt(goal.target_minor))}</p>
                  <p className="mt-1 text-sm font-semibold tabular">{progress.reached ? s.allSaved : s.toGo(fmt(progress.remainingMinor))}</p>
                </>
              )}
            </div>
          </div>

          {bought ? (
            <p className="mt-5 text-sm">{s.savedTotal(fmt(goal.added_minor - goal.taken_minor))}</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-1 text-sm" data-testid="goal-hints">
              {hints(goal, plan, paceWeeks, fmt).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {bought ? (
              <Button variant="secondary" onClick={() => open({ kind: 'reopen' })} disabled={!online}>
                {s.notBought}
              </Button>
            ) : (
              <>
                <Button onClick={() => editor.openCreate('savings', { goalId: goal.id })} disabled={!online}>
                  {s.addMoney}
                </Button>
                <Button variant="secondary" onClick={() => open({ kind: 'takeOut' })} disabled={!online || goal.saved_minor <= 0}>
                  {s.takeOut}
                </Button>
                <Button
                  variant={progress.reached ? 'primary' : 'secondary'}
                  onClick={() => open({ kind: 'bought' })}
                  disabled={!online || !categories.data}
                >
                  {s.bought}
                </Button>
              </>
            )}
          </div>
        </Card>

        <GoalHistory goal={goal} money={money} onOpenDialog={open} />
      </div>

      <ResponsiveDialog open={dialog.kind === 'edit'} onOpenChange={(next) => (next ? undefined : close())} title={s.form.editTitle} description={s.form.description}>
        <GoalForm key={dialogKey} money={money} goal={goal} photo={photo} onSaved={close} />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.kind === 'takeOut'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.takeOutForm.title}
        description={s.takeOutForm.description(goal.name)}
      >
        <TakeOutForm key={dialogKey} goal={goal} money={money} onClose={close} />
      </ResponsiveDialog>

      <ResponsiveDialog open={dialog.kind === 'bought'} onOpenChange={(next) => (next ? undefined : close())} title={s.boughtForm.title} description={s.boughtForm.description}>
        {categories.data ? (
          <BoughtForm
            key={dialogKey}
            goal={goal}
            money={money}
            categories={categories.data}
            onBought={() => {
              close();
              setCelebrating(true);
              toast({ message: s.boughtToast });
            }}
          />
        ) : null}
      </ResponsiveDialog>

      <ConfirmDialog
        open={dialog.kind === 'delete'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.confirmDelete.title}
        body={!bought && goal.saved_minor > 0 ? s.confirmDelete.withMoney(fmt(goal.saved_minor)) : s.confirmDelete.empty}
        confirmLabel={s.confirmDelete.confirm}
        pending={setDeleted.isPending}
        onConfirm={deleteGoal}
      />

      <ConfirmDialog
        open={dialog.kind === 'reopen'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={s.confirmReopen.title}
        body={s.confirmReopen.body}
        confirmLabel={s.confirmReopen.confirm}
        pending={reopen.isPending}
        onConfirm={() =>
          reopen.mutate(goal.id, {
            onSuccess: () => {
              toast({ message: s.reopened });
              close();
            },
            onError: (error) => toast({ message: errorMessage(error) }),
          })
        }
      />

      <WithdrawalDeleteDialog dialog={dialog} onClose={close} />
    </>
  );
}

function WithdrawalDeleteDialog({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const remove = useSetWithdrawalDeleted();
  const toast = useToast();
  return (
    <ConfirmDialog
      open={dialog.kind === 'deleteWithdrawal'}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={s.confirmDeleteWithdrawal.title}
      body={s.confirmDeleteWithdrawal.body}
      confirmLabel={s.confirmDeleteWithdrawal.confirm}
      pending={remove.isPending}
      onConfirm={() => {
        if (dialog.kind !== 'deleteWithdrawal') return;
        const id = dialog.transaction.id;
        remove.mutate(
          { id, deleted: true },
          {
            onSuccess: () => {
              toast({
                message: strings.transactions.deleted.withdrawal,
                action: { label: strings.transactions.undo, onAction: () => remove.mutate({ id, deleted: false }) },
              });
              onClose();
            },
            onError: (error) => toast({ message: errorMessage(error) }),
          },
        );
      }}
    />
  );
}

/**
 * The goal's money in and out, newest first, grouped by day: savings put in (edit or delete like
 * any transaction), money taken out (tap to delete it), and the purchase once bought (tap to undo
 * it). Pages of 50 as the button asks for more; goals rarely have many entries.
 */
function GoalHistory({ goal, money, onOpenDialog }: { goal: Goal; money: MoneyContext; onOpenDialog: (dialog: Dialog) => void }) {
  const pages = useTransactionPages({ goalId: goal.id });
  const categories = useCategoryMap();
  const editor = useTransactionEditor();
  const deleteWithUndo = useDeleteWithUndo();
  const removeWithdrawal = useSetWithdrawalDeleted();
  const toast = useToast();
  const online = useOnlineStatus();
  const today = todayLocal();
  const transactions = useMemo(() => pages.data?.pages.flat() ?? [], [pages.data]);
  const isOpen = goal.bought_on === null;

  // Stable handlers that read the latest values, so memoized rows don't re-render.
  const latest = useRef({ goal, editor, onOpenDialog, deleteWithUndo, removeWithdrawal, toast });
  useLayoutEffect(() => {
    latest.current = { goal, editor, onOpenDialog, deleteWithUndo, removeWithdrawal, toast };
  });
  const openRow = useCallback((transaction: Transaction) => {
    const { goal: current, editor: ed, onOpenDialog: openDialog } = latest.current;
    if (transaction.type === 'savings') ed.openEdit(transaction);
    else if (transaction.type === 'withdrawal' && transaction.id !== current.closing_transaction_id && current.bought_on === null) {
      openDialog({ kind: 'deleteWithdrawal', transaction });
    } else if (current.bought_on !== null) openDialog({ kind: 'reopen' });
  }, []);
  const deleteRow = useCallback((transaction: Transaction) => {
    const { deleteWithUndo: remove, removeWithdrawal: take, toast: show } = latest.current;
    if (transaction.type === 'savings') {
      remove(transaction);
      return;
    }
    take.mutate(
      { id: transaction.id, deleted: true },
      {
        onSuccess: () =>
          show({
            message: strings.transactions.deleted.withdrawal,
            action: { label: strings.transactions.undo, onAction: () => take.mutate({ id: transaction.id, deleted: false }) },
          }),
        onError: (error) => show({ message: errorMessage(error) }),
      },
    );
  }, []);

  let body;
  if (pages.isError && pages.data === undefined) body = <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />;
  else if (pages.isPending) body = <Skeleton className="m-3 h-20" />;
  else if (transactions.length === 0) body = <p className="px-3 pb-4 text-sm text-fg-muted">{s.noHistory}</p>;
  else {
    body = (
      <div>
        {transactions.map((transaction, index) => (
          <Fragment key={transaction.id}>
            {transaction.date !== transactions[index - 1]?.date ? (
              <h3 className="px-2 pt-3 pb-1 text-sm font-semibold text-fg-muted">{formatDayHeading(transaction.date, today, strings.transactions)}</h3>
            ) : null}
            <TransactionRow
              transaction={transaction}
              category={categories.get(transaction.category_id)}
              money={money}
              onOpen={openRow}
              showGoal={false}
              // Only while the goal is open: savings, and money taken out (not what paid for it).
              onDelete={online && isOpen && (transaction.type === 'savings' || transaction.type === 'withdrawal') ? deleteRow : undefined}
            />
          </Fragment>
        ))}
        {pages.hasNextPage ? (
          <div className="flex justify-center p-2">
            <Button variant="ghost" loading={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>
              {strings.goals.loadMore}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="p-2">
      <section aria-labelledby="goal-history">
        <h2 id="goal-history" className="px-3 pt-3 pb-1 text-xl font-bold">
          {s.history}
        </h2>
        {body}
      </section>
    </Card>
  );
}
