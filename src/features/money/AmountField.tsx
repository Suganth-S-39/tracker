import { useId } from 'react';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import type { MoneyContext } from './useMoney';

type AmountFieldProps = {
  label: string;
  amountText: string;
  onAmountChange: (text: string) => void;
  currency: string;
  onCurrencyChange: (code: string) => void;
  money: MoneyContext;
  error?: string | undefined;
  /** Colors the amount: green for money in, red for money out (sign shown elsewhere). */
  tone?: 'income' | 'expense' | 'neutral';
  currencyLocked?: boolean;
  autoFocus?: boolean;
};

/** The large amount input with its currency picker. Amounts use the decimal keypad on phones. */
export function AmountField({
  label,
  amountText,
  onAmountChange,
  currency,
  onCurrencyChange,
  money,
  error,
  tone = 'neutral',
  currencyLocked = false,
  autoFocus = false,
}: AmountFieldProps) {
  const amountId = useId();
  const currencyId = useId();
  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor={amountId} className="text-sm font-medium">
            {label}
          </label>
          <input
            id={amountId}
            data-autofocus={autoFocus || undefined}
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(e) => onAmountChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${amountId}-error` : undefined}
            className={cx(
              'mt-1.5 block h-16 w-full rounded-control border border-control-border bg-surface px-4 text-3xl font-bold tabular',
              'aria-invalid:border-expense-strong',
              tone === 'expense' ? 'text-expense-strong' : tone === 'income' ? 'text-income-strong' : 'text-fg',
            )}
          />
        </div>
        <div className="w-28">
          <label htmlFor={currencyId} className="text-sm font-medium">
            {strings.form.currency}
          </label>
          <select
            id={currencyId}
            value={currency}
            disabled={currencyLocked}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="mt-1.5 block h-16 w-full rounded-control border border-control-border bg-surface px-3 text-base font-semibold disabled:opacity-60"
          >
            {money.currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <p id={`${amountId}-error`} className="mt-1.5 text-sm font-medium text-expense-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
