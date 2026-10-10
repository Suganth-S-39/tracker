import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { CategoryPicker } from '@/features/categories/CategoryPicker';
import { selectableCategories, type Category } from '@/features/categories/api';
import { AmountField } from '@/features/money/AmountField';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate, todayLocal } from '@/domain/dates';
import { amountInputValue, formatMoney, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useCompleteGoal, type Goal } from './api';

const s = strings.goals.boughtForm;

/** Starts on Shopping when there is one (most goals are things you buy), else the first category. */
function defaultCategory(options: readonly Category[]): string {
  return (options.find((c) => c.name.toLowerCase() === 'shopping') ?? options[0])?.id ?? '';
}

/**
 * "I bought it!": what it actually cost, recorded as an expense paid from the goal. Shows where
 * the money comes from before saving: the goal, plus the balance if it cost more (or the leftover
 * going back if it cost less).
 */
export function BoughtForm({
  goal,
  money,
  categories,
  onBought,
}: {
  goal: Goal;
  money: MoneyContext;
  categories: readonly Category[];
  onBought: () => void;
}) {
  const { baseCurrency, exponentOf } = money;
  const exponent = exponentOf(baseCurrency);
  const options = selectableCategories(categories, 'expense');
  const [amountText, setAmountText] = useState(amountInputValue(goal.target_minor, exponent));
  const [categoryId, setCategoryId] = useState(() => defaultCategory(options));
  const [date, setDate] = useState(todayLocal());
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const complete = useCompleteGoal();
  const online = useOnlineStatus();

  const fmt = (minor: number) => formatMoney(minor, baseCurrency, exponent);
  const costMinor = parseAmount(amountText, exponent);
  const errors = {
    amount:
      amountText.trim() !== '' && costMinor === null
        ? strings.form.errors.amountFormat(exponent)
        : !costMinor
          ? strings.form.errors.amount
          : undefined,
    category: options.some((c) => c.id === categoryId) ? undefined : strings.form.errors.category,
    date: isIsoDate(date) ? undefined : strings.form.errors.date,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || !costMinor) return;
    complete.mutate({ goalId: goal.id, categoryId, date, amountMinor: costMinor, payee, note }, { onSuccess: onBought });
  }

  const saved = goal.saved_minor;
  const breakdown =
    costMinor && costMinor > 0
      ? [
          saved > 0 ? s.fromGoal(fmt(Math.min(saved, costMinor))) : null,
          costMinor > saved ? s.extra(fmt(costMinor - saved)) : saved > costMinor ? s.leftover(fmt(saved - costMinor)) : null,
        ].filter(Boolean)
      : [];

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <AmountField
          label={s.cost}
          amountText={amountText}
          onAmountChange={setAmountText}
          currency={baseCurrency}
          onCurrencyChange={() => {}}
          currencyLocked
          money={money}
          tone="expense"
          autoFocus
          error={shown(errors.amount)}
        />
        {breakdown.length > 0 ? (
          <div aria-live="polite" className="mt-2 rounded-control bg-control px-3.5 py-2.5 text-sm">
            {breakdown.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="mt-1 text-fg-muted">{s.budgetNote}</p>
          </div>
        ) : null}
      </div>
      <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} error={shown(errors.category)} />
      <div className="grid gap-4 wide:grid-cols-2">
        <TextField label={strings.form.date} type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
        <TextField label={s.payee} hint={strings.common.optional} maxLength={100} autoComplete="off" value={payee} onChange={(e) => setPayee(e.target.value)} />
      </div>
      <TextField label={strings.form.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      {complete.isError ? <Alert tone="error">{errorMessage(complete.error)}</Alert> : null}
      {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}
      <Button type="submit" size="lg" fullWidth loading={complete.isPending} disabled={!online}>
        {s.save}
      </Button>
    </form>
  );
}
