import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MoneyContext } from '@/features/money/useMoney';
import { formatMoney } from '@/domain/money';
import { strings } from '@/strings/en';
import { useIouTotals } from './api';

const s = strings.ious;

/** Home's IOU card (spec section 8): "You owe" and "You're owed"; opens the IOU page. */
export function IouSummaryCard({ money }: { money: MoneyContext | null }) {
  const totals = useIouTotals();
  if (totals.isError && totals.data === undefined) return null; // The IOU page shows the error; Home stays usable.

  const fmt = (minor: number, approximate: boolean) => {
    if (!money) return '';
    const text = formatMoney(minor, money.baseCurrency, money.exponentOf(money.baseCurrency));
    return approximate && minor > 0 ? s.approx(text) : text;
  };

  return (
    <Card className="p-0">
      <Link to="/ious" aria-label={s.summaryLabel} className="flex items-stretch gap-2 rounded-card p-2 hover:bg-hover">
        {(
          [
            { key: 'owed', label: s.youreOwed, Icon: ArrowDownLeft, tone: 'bg-income-tint text-income-strong', value: totals.data?.owedToMeMinor, approximate: totals.data?.owedApproximate ?? false },
            { key: 'owe', label: s.youOwe, Icon: ArrowUpRight, tone: 'bg-expense-tint text-expense-strong', value: totals.data?.iOweMinor, approximate: totals.data?.oweApproximate ?? false },
          ] as const
        ).map(({ key, label, Icon, tone, value, approximate }) => (
          <div key={key} className="flex flex-1 items-center gap-3 rounded-2xl px-3 py-3">
            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`}>
              <Icon className="size-4.5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-fg-muted">{label}</span>
              {value === undefined || !money ? (
                <Skeleton className="mt-1 h-5 w-20" />
              ) : (
                <span className="block truncate font-bold tabular" data-testid={`iou-${key}`}>
                  {fmt(value, approximate)}
                </span>
              )}
            </span>
          </div>
        ))}
        <ChevronRight aria-hidden="true" className="mr-2 size-4 self-center text-fg-muted" />
      </Link>
    </Card>
  );
}
