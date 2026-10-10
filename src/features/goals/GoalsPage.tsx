import { ChevronRight, Plus, Target } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoney, type MoneyContext } from '@/features/money/useMoney';
import { formatDate } from '@/domain/dates';
import { goalProgress } from '@/domain/goals';
import { formatMoney } from '@/domain/money';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { openGoals, useGoalPhotos, useGoals, type Goal } from './api';
import { GoalForm } from './GoalForm';
import { GoalBadge, GoalProgressBar } from './GoalVisuals';

const s = strings.goals;

/** One open goal: badge, name, date, progress. The whole card opens the goal. */
function OpenGoalCard({ goal, photo, money }: { goal: Goal; photo: string | undefined; money: MoneyContext }) {
  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  const progress = goalProgress(goal.saved_minor, goal.target_minor);
  return (
    <li>
      <Link
        to={`/goals/${goal.id}`}
        aria-label={s.openLabel(goal.name, fmt(goal.saved_minor), fmt(goal.target_minor))}
        className="glass flex flex-col gap-3 rounded-card p-4 hover:bg-hover"
      >
        <span className="flex items-center gap-3">
          <GoalBadge icon={goal.icon} photo={photo} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold">{goal.name}</span>
            {goal.target_date ? <span className="block text-sm text-fg-muted">{s.by(formatDate(goal.target_date))}</span> : null}
          </span>
          <span className="shrink-0 text-lg font-bold tabular">{s.percent(progress.percent)}</span>
        </span>
        <GoalProgressBar fraction={progress.fraction} />
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold tabular">{s.savedOf(fmt(goal.saved_minor), fmt(goal.target_minor))}</span>
          <span className="text-fg-muted tabular">{progress.reached ? s.allSaved : s.toGo(fmt(progress.remainingMinor))}</span>
        </span>
      </Link>
    </li>
  );
}

/** A bought goal, in the "Bought" list. */
function BoughtGoalRow({ goal, photo, money }: { goal: Goal; photo: string | undefined; money: MoneyContext }) {
  const date = formatDate(goal.bought_on ?? '');
  return (
    <li>
      <Link to={`/goals/${goal.id}`} aria-label={s.boughtLabel(goal.name, date)} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-hover">
        <GoalBadge icon={goal.icon} photo={photo} bought />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{goal.name}</span>
          <span className="block text-sm text-fg-muted">{s.boughtOn(date)}</span>
        </span>
        <span className="shrink-0 font-bold tabular">{formatMoney(goal.spent_minor, money.baseCurrency, money.exponentOf(money.baseCurrency))}</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      </Link>
    </li>
  );
}

/** Goals: what you're saving up for, then what you've bought. ?new opens the New goal form. */
export function GoalsPage() {
  const goals = useGoals();
  const photos = useGoalPhotos(goals.data);
  const money = useMoney();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [formKey, setFormKey] = useState(0);
  const creating = params.has('new');

  const openForm = () => {
    setFormKey((k) => k + 1);
    setParams({ new: '' }, { replace: true });
  };
  const closeForm = () => setParams({}, { replace: true });

  const addButton = (
    <Button onClick={openForm} disabled={!online} icon={<Plus aria-hidden="true" className="size-4" />}>
      {s.add}
    </Button>
  );

  let body;
  if (goals.isError && goals.data === undefined) {
    body = (
      <Card>
        <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
      </Card>
    );
  } else if (!goals.data || !money) {
    body = (
      <div className="grid gap-4 wide:grid-cols-2" aria-hidden="true">
        <Skeleton className="h-36 rounded-card" />
        <Skeleton className="h-36 rounded-card" />
      </div>
    );
  } else if (goals.data.length === 0) {
    body = (
      <Card>
        <EmptyState icon={Target} title={s.emptyTitle} body={s.emptyBody} action={addButton} />
      </Card>
    );
  } else {
    const open = openGoals(goals.data);
    const bought = goals.data.filter((goal) => goal.bought_on !== null);
    body = (
      <div className="flex flex-col gap-6">
        {open.length > 0 ? (
          <section aria-label={s.open}>
            <ul className="grid gap-4 wide:grid-cols-2">
              {open.map((goal) => (
                <OpenGoalCard key={goal.id} goal={goal} photo={photos.data?.[goal.id]} money={money} />
              ))}
            </ul>
          </section>
        ) : null}
        {bought.length > 0 ? (
          <section aria-labelledby="goals-bought">
            <Card className="p-2">
              <h2 id="goals-bought" className="px-3 pt-3 pb-1 text-xl font-bold">
                {s.done}
              </h2>
              <ul>
                {bought.map((goal) => (
                  <BoughtGoalRow key={goal.id} goal={goal} photo={photos.data?.[goal.id]} money={money} />
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PageHeader title={strings.pages.goals.title} actions={goals.data && goals.data.length > 0 ? addButton : undefined} />
      <div className="mt-4">{body}</div>

      <ResponsiveDialog
        open={creating && money !== null}
        onOpenChange={(next) => (next ? undefined : closeForm())}
        title={s.form.addTitle}
        description={s.form.description}
      >
        {money ? (
          <GoalForm
            key={formKey}
            money={money}
            onSaved={(id) => {
              // Close the form (so Back from the goal returns to this list, not the form), then open it.
              closeForm();
              void navigate(`/goals/${id}`);
            }}
          />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}
