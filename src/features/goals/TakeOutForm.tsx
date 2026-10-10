import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { AmountField } from '@/features/money/AmountField';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate, todayLocal } from '@/domain/dates';
import { formatMoney, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useSetWithdrawalDeleted, useTakeFromGoal, type Goal } from './api';

const s = strings.goals.takeOutForm;

/** Takes money out of a goal, back into the balance (base currency, up to what's in it). */
export function TakeOutForm({ goal, money, onClose }: { goal: Goal; money: MoneyContext; onClose: () => void }) {
  const { baseCurrency, exponentOf } = money;
  const exponent = exponentOf(baseCurrency);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const take = useTakeFromGoal();
  const undo = useSetWithdrawalDeleted();
  const toast = useToast();
  const online = useOnlineStatus();

  const fmt = (minor: number) => formatMoney(minor, baseCurrency, exponent);
  const amountMinor = parseAmount(amountText, exponent);
  const errors = {
    amount:
      amountText.trim() !== '' && amountMinor === null
        ? strings.form.errors.amountFormat(exponent)
        : !amountMinor
          ? strings.form.errors.amount
          : amountMinor > goal.saved_minor
            ? s.errors.tooMuch(fmt(goal.saved_minor))
            : undefined,
    date: isIsoDate(date) ? undefined : strings.form.errors.date,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || !amountMinor) return;
    take.mutate(
      { goalId: goal.id, amountMinor, date, note },
      {
        onSuccess: (id) => {
          toast({
            message: strings.goals.takenOut(fmt(amountMinor)),
            action: { label: strings.transactions.undo, onAction: () => undo.mutate({ id, deleted: true }) },
          });
          onClose();
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <AmountField
          label={s.amount}
          amountText={amountText}
          onAmountChange={setAmountText}
          currency={baseCurrency}
          onCurrencyChange={() => {}}
          currencyLocked
          money={money}
          tone="savings"
          autoFocus
          error={shown(errors.amount)}
        />
        {shown(errors.amount) ? null : <p className="mt-1.5 text-sm text-fg-muted tabular">{s.available(fmt(goal.saved_minor))}</p>}
      </div>
      <div className="grid gap-4 wide:grid-cols-2">
        <TextField label={strings.form.date} type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
        <TextField label={strings.form.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {take.isError ? <Alert tone="error">{errorMessage(take.error)}</Alert> : null}
      {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}
      <Button type="submit" size="lg" fullWidth loading={take.isPending} disabled={!online}>
        {s.save}
      </Button>
    </form>
  );
}
