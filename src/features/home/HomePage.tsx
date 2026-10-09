import { CircleUserRound } from 'lucide-react';
import { Link } from 'react-router';
import { BudgetSnapshot } from '@/features/budgets/BudgetSnapshot';
import { IouSummaryCard } from '@/features/ious/IouSummaryCard';
import { useMoney } from '@/features/money/useMoney';
import { MonthSelector } from '@/features/month/MonthSelector';
import { useSelectedMonth } from '@/features/month/month-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { strings } from '@/strings/en';
import { HeroCard } from './HeroCard';
import { RecentTransactions } from './RecentTransactions';

/**
 * Home (spec section 8), top to bottom on phones: top bar, balance, IOU summary, budget snapshot,
 * recent transactions. Wide screens: balance and IOUs beside the budget, recent transactions below.
 */
export function HomePage() {
  const money = useMoney();
  const { month } = useSelectedMonth();
  usePageTitle(strings.pages.home.title);

  return (
    <>
      <header className="flex min-h-14 items-center justify-between gap-3 pt-safe">
        <h1 className="sr-only">{strings.pages.home.title}</h1>
        <Link
          to="/settings"
          aria-label={strings.nav.openSettings}
          className="grid size-11 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
        >
          <CircleUserRound aria-hidden="true" className="size-7" />
        </Link>
        <MonthSelector />
      </header>

      <div className="mt-4 grid gap-4 wide:grid-cols-2 wide:items-start">
        <div className="flex flex-col gap-4">
          <HeroCard month={month} money={money} />
          <IouSummaryCard money={money} />
        </div>
        <BudgetSnapshot month={month} money={money} />
        <div className="wide:col-span-2">
          <RecentTransactions month={month} money={money} />
        </div>
      </div>
    </>
  );
}
