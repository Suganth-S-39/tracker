import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { categoryLabel, type Category } from '@/features/categories/api';
import type { MoneyContext } from '@/features/money/useMoney';
import { amountInputValue, parseAmount } from '@/domain/money';
import type { MonthKey } from '@/domain/dates';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useSetBudget } from './api';

const s = strings.budgets;

export type BudgetEditorTarget =
  | { kind: 'overall'; amountMinor?: number }
  | { kind: 'category'; categoryId?: string; amountMinor?: number };

type BudgetEditorProps = {
  target: BudgetEditorTarget;
  month: MonthKey;
  money: MoneyContext;
  /** Categories that can get a new budget (for adding). */
  availableCategories: readonly Category[];
  categoryName: (id: string) => string;
  onDone: () => void;
};

/** Set, change or remove a budget from the selected month onward. */
export function BudgetEditor({ target, month, money, availableCategories, categoryName, onDone }: BudgetEditorProps) {
  const exponent = money.exponentOf(money.baseCurrency);
  const existing = target.amountMinor !== undefined;
  const [amountText, setAmountText] = useState(existing ? amountInputValue(target.amountMinor ?? 0, exponent) : '');
  const [categoryId, setCategoryId] = useState(target.kind === 'category' ? (target.categoryId ?? '') : '');
  const [showErrors, setShowErrors] = useState(false);
  const setBudget = useSetBudget();
  const toast = useToast();
  const online = useOnlineStatus();
  const amountId = useId();

  const amountMinor = parseAmount(amountText, exponent);
  const errors = {
    amount: !amountMinor ? s.errors.amount : undefined,
    category: target.kind === 'category' && !categoryId ? s.errors.category : undefined,
  };

  function save(amount: number, message: string) {
    setBudget.mutate(
      { month, categoryId: target.kind === 'category' ? categoryId : null, amountMinor: amount },
      {
        onSuccess: () => {
          toast({ message });
          onDone();
        },
      },
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (errors.amount || errors.category || !amountMinor) return;
    save(amountMinor, s.saved);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {target.kind === 'category' ? (
        existing && target.categoryId ? (
          <p className="text-lg font-semibold">{categoryName(target.categoryId)}</p>
        ) : (
          <SelectField
            label={s.editor.category}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            error={showErrors ? errors.category : undefined}
          >
            <option value="" disabled>
              {s.editor.category}
            </option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c)}
              </option>
            ))}
          </SelectField>
        )
      ) : null}

      <TextField
        id={amountId}
        label={s.editor.amount(money.baseCurrency)}
        data-autofocus
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        error={showErrors ? errors.amount : undefined}
        className="text-xl font-semibold tabular"
      />

      {setBudget.isError ? <Alert tone="error">{errorMessage(setBudget.error)}</Alert> : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" fullWidth loading={setBudget.isPending} disabled={!online}>
          {s.editor.save}
        </Button>
        {existing ? (
          <Button variant="ghost" fullWidth className="text-expense-strong" disabled={!online} onClick={() => save(0, s.removed)}>
            {s.editor.remove}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
