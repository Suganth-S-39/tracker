import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, formatMonth } from '@/domain/dates';
import { strings } from '@/strings/en';
import { useSelectedMonth } from './month-context';

export function MonthSelector() {
  const { month, setMonth } = useSelectedMonth();
  return (
    <div role="group" aria-label={strings.month.label} className="flex items-center rounded-full bg-surface p-1 shadow-card">
      <button
        type="button"
        aria-label={strings.month.previous}
        onClick={() => setMonth(addMonths(month, -1))}
        className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <span aria-live="polite" className="min-w-34 px-1 text-center text-sm font-semibold tabular">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        aria-label={strings.month.next}
        onClick={() => setMonth(addMonths(month, 1))}
        className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
