import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { CategoryPicker } from '@/features/categories/CategoryPicker';
import { selectableCategories, type Category } from '@/features/categories/api';
import { AmountField } from '@/features/money/AmountField';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate } from '@/domain/dates';
import { amountInputValue, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useUpdateRecurringRule, type Frequency, type RecurringRule } from './api';

const FREQUENCIES: readonly Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const s = strings.recurring;

/**
 * Edits a recurring rule. Changes apply from the next occurrence; occurrences already added keep
 * their values. Foreign-currency rules convert each occurrence at the rate of the day (no rate
 * is stored on the rule).
 */
export function RecurringRuleForm({
  rule,
  money,
  categories,
  onClose,
}: {
  rule: RecurringRule;
  money: MoneyContext;
  categories: readonly Category[];
  onClose: () => void;
}) {
  const { exponentOf } = money;
  const [amountText, setAmountText] = useState(amountInputValue(rule.amount_minor, exponentOf(rule.currency)));
  const [currency, setCurrency] = useState(rule.currency);
  const [categoryId, setCategoryId] = useState(rule.category_id);
  const [frequency, setFrequency] = useState<Frequency>(rule.frequency);
  const [nextDueDate, setNextDueDate] = useState(rule.next_due_date);
  const [payee, setPayee] = useState(rule.payee ?? '');
  const [note, setNote] = useState(rule.note ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const update = useUpdateRecurringRule();
  const toast = useToast();
  const online = useOnlineStatus();

  const amountMinor = parseAmount(amountText, exponentOf(currency));
  const options = selectableCategories(categories, rule.type, rule.category_id);
  const errors = {
    amount: !amountMinor ? strings.form.errors.amount : undefined,
    category: options.some((c) => c.id === categoryId) ? undefined : strings.form.errors.category,
    date: isIsoDate(nextDueDate) ? undefined : strings.form.errors.date,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || !amountMinor) return;
    update.mutate(
      {
        id: rule.id,
        input: { type: rule.type, categoryId, amountMinor, currency, frequency, nextDueDate, payee, note },
      },
      {
        onSuccess: () => {
          toast({ message: s.updated });
          onClose();
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <AmountField
        label={strings.form.amount}
        amountText={amountText}
        onAmountChange={setAmountText}
        currency={currency}
        onCurrencyChange={setCurrency}
        money={money}
        tone={rule.type}
        autoFocus
        error={shown(errors.amount)}
      />
      <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} error={shown(errors.category)} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={s.form.frequency} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {s.frequencies[f]}
            </option>
          ))}
        </SelectField>
        <TextField label={s.form.nextDate} type="date" required value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} error={shown(errors.date)} />
      </div>
      <TextField label={strings.form.payee[rule.type]} hint={strings.common.optional} maxLength={100} value={payee} onChange={(e) => setPayee(e.target.value)} />
      <TextField label={strings.form.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      {update.isError ? <Alert tone="error">{errorMessage(update.error)}</Alert> : null}
      <Button type="submit" size="lg" fullWidth loading={update.isPending} disabled={!online}>
        {s.form.save}
      </Button>
    </form>
  );
}
