import { ChevronRight, Target } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MoneyContext } from '@/features/money/useMoney';
import { goalProgress } from '@/domain/goals';
import { formatMoney } from '@/domain/money';
import { strings } from '@/strings/en';
import { openGoals, useGoalPhotos, useGoals } from './api';
import { GoalBadge, GoalProgressBar } from './GoalVisuals';

const s = strings.goals;

/** How many goals Home shows; the rest are a tap away on Goals. */
const HOME_GOALS = 3;

/**
 * Home's goals: the first few being saved for, with their progress. With none, a one-line
 * invitation to make one (small, so it doesn't push the rest of Home down).
 */
export function GoalsCard({ money }: { money: MoneyContext | null }) {
  const goals = useGoals();
  const photos = useGoalPhotos(goals.data);
  const headingId = useId();
  if (goals.isError && goals.data === undefined) return null; // The Goals page shows the error; Home stays usable.

  if (!goals.data || !money) {
    // As tall as the one-line invitation (what a new account sees), so Home doesn't jump.
    return <Skeleton className="h-[4.875rem] rounded-card" />;
  }

  const open = openGoals(goals.data).slice(0, HOME_GOALS);
  if (open.length === 0) {
    return (
      <Card className="p-0">
        <Link to="/goals?new" className="flex items-center gap-3 rounded-card p-4 hover:bg-hover">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-savings-tint text-savings-strong">
            <Target className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-fg-muted">{s.homeEmpty}</span>
            <span className="block font-semibold">{s.homeEmptyAction}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
        </Link>
      </Card>
    );
  }

  const exponent = money.exponentOf(money.baseCurrency);
  const fmt = (minor: number) => formatMoney(minor, money.baseCurrency, exponent);
  return (
    <Card className="p-2">
      <section aria-labelledby={headingId}>
        <div className="flex items-center justify-between px-3 pt-2">
          <h2 id={headingId} className="text-xl font-bold">
            {strings.pages.goals.title}
          </h2>
          <Link to="/goals" aria-label={s.seeAllLabel} className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent-strong hover:bg-hover">
            {s.seeAll}
          </Link>
        </div>
        <ul>
          {open.map((goal) => {
            const progress = goalProgress(goal.saved_minor, goal.target_minor);
            return (
              <li key={goal.id}>
                <Link
                  to={`/goals/${goal.id}`}
                  aria-label={s.openLabel(goal.name, fmt(goal.saved_minor), fmt(goal.target_minor))}
                  className="flex items-center gap-3 rounded-control px-3 py-3 hover:bg-hover"
                >
                  <GoalBadge icon={goal.icon} photo={photos.data?.[goal.id]} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{goal.name}</span>
                      <span className="shrink-0 text-sm font-bold tabular">{s.percent(progress.percent)}</span>
                    </span>
                    <GoalProgressBar fraction={progress.fraction} className="my-1.5" />
                    <span className="block truncate text-sm text-fg-muted tabular" data-testid="home-goal-saved">
                      {s.savedOf(fmt(goal.saved_minor), fmt(goal.target_minor))}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
