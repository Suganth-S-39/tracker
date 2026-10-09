import { Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toast-context';
import { CategoryPicker } from '@/features/categories/CategoryPicker';
import { selectableCategories, type Category } from '@/features/categories/api';
import { IouForm } from '@/features/ious/IouForm';
import { AmountField } from '@/features/money/AmountField';
import { ConversionPanel } from '@/features/money/ConversionPanel';
import { useConversion } from '@/features/money/useConversion';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate, todayLocal } from '@/domain/dates';
import { amountInputValue, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useRecentPayees, useSaveTransaction, type Transaction, type TransactionInput } from './api';
import type { EditorKind } from './editor-context';
import { useDeleteWithUndo } from './useDeleteWithUndo';
import { TRANSACTION_TYPES } from './kinds';

/** How many recent payees the "Paid to" field suggests. */
const PAYEE_SUGGESTIONS = 50;

type Repeat = NonNullable<TransactionInput['repeat']> | 'none';
const REPEAT_OPTIONS: readonly Repeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

type TransactionFormProps = {
  money: MoneyContext;
  categories: readonly Category[];
  transaction?: Transaction | undefined;
  initialKind?: EditorKind;
  onClose: () => void;
};

const s = strings.form;

/**
 * Add / edit form (spec section 8): Expense / Income / IOU. The amount is focused on open;
 * foreign currencies show an editable rate and converted amount; new transactions can repeat.
 */
export function TransactionForm({ money, categories, transaction, initialKind = 'expense', onClose }: TransactionFormProps) {
  const editing = transaction !== undefined;
  const { baseCurrency, exponentOf } = money;

  const [kind, setKind] = useState<EditorKind>(transaction?.type ?? initialKind);
  const [currency, setCurrency] = useState(transaction?.original_currency ?? baseCurrency);
  const [amountText, setAmountText] = useState(
    transaction ? amountInputValue(transaction.original_amount_minor, exponentOf(transaction.original_currency)) : '',
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '');
  const [date, setDate] = useState(transaction?.date ?? todayLocal());
  const [payee, setPayee] = useState(transaction?.payee ?? '');
  const [note, setNote] = useState(transaction?.note ?? '');
  const [repeat, setRepeat] = useState<Repeat>('none');
  // Editing without touching amount, currency or rate saves the stored values unchanged.
  const [moneyTouched, setMoneyTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const online = useOnlineStatus();
  const toast = useToast();
  const save = useSaveTransaction();
  const deleteWithUndo = useDeleteWithUndo();
  const payees = useRecentPayees();

  const amountMinor = parseAmount(amountText, exponentOf(currency));
  const conversion = useConversion({
    amountMinor,
    currency,
    target: baseCurrency,
    exponentOf,
    stored: transaction ? { currency: transaction.original_currency, rate: transaction.exchange_rate } : undefined,
  });

  const type = kind === 'iou' ? 'expense' : kind;
  const options = selectableCategories(categories, type, transaction?.category_id);

  const errors = {
    amount:
      amountText.trim() !== '' && amountMinor === null
        ? s.errors.amountFormat(exponentOf(currency))
        : !amountMinor
          ? s.errors.amount
          : undefined,
    category: options.some((c) => c.id === categoryId) ? undefined : s.errors.category,
    date: isIsoDate(date) ? undefined : s.errors.date,
    conversion: conversion.conversion.invalid ?? undefined,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function changeKind(next: EditorKind) {
    setKind(next);
    if (next !== kind) setCategoryId('');
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || kind === 'iou' || amountMinor === null) return;

    const keepStored = editing && !moneyTouched;
    const exchangeRate = keepStored ? transaction.exchange_rate : conversion.conversion.rate;
    const baseAmountMinor = keepStored ? transaction.base_amount_minor : conversion.conversion.convertedMinor;
    if (exchangeRate === null || baseAmountMinor === null) return;

    save.mutate(
      {
        ...(editing ? { id: transaction.id } : {}),
        input: {
          type: kind,
          categoryId,
          date,
          originalAmountMinor: amountMinor,
          originalCurrency: currency,
          exchangeRate,
          baseAmountMinor,
          payee,
          note,
          repeat: !editing && repeat !== 'none' ? repeat : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ message: editing ? strings.transactions.updated : strings.transactions.added[kind] });
          onClose();
        },
      },
    );
  }

  const payeeListId = useId();
  const kindOptions = (editing ? TRANSACTION_TYPES : [...TRANSACTION_TYPES, 'iou' as const]).map((value) => ({
    value,
    label: s.kindTabs[value],
  }));

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl label={s.kindLabel} value={kind} options={kindOptions} onChange={changeKind} />

      {kind === 'iou' ? (
        <IouForm money={money} onClose={onClose} />
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <AmountField
            label={s.amount}
            amountText={amountText}
            onAmountChange={(text) => {
              setAmountText(text);
              setMoneyTouched(true);
              conversion.amountChanged();
            }}
            currency={currency}
            onCurrencyChange={(code) => {
              setCurrency(code);
              setMoneyTouched(true);
              conversion.reset();
            }}
            money={money}
            tone={kind}
            autoFocus
            error={shown(errors.amount)}
          />

          <ConversionPanel state={conversion} showErrors={showErrors} onEdit={() => setMoneyTouched(true)} />

          <div>
            <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} error={shown(errors.category)} />
            <Link to="/settings/categories" onClick={onClose} className="mt-2 inline-block text-sm font-semibold text-accent-strong hover:underline">
              {s.manageCategories}
            </Link>
          </div>

          <div className="grid gap-4 wide:grid-cols-2">
            <TextField label={s.date} type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
            <TextField
              label={s.payee[kind]}
              hint={strings.common.optional}
              list={payeeListId}
              autoComplete="off"
              maxLength={100}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
            <datalist id={payeeListId}>
              {/* The most recent payees only: every option is built each time the form opens. */}
              {(payees.data ?? []).slice(0, PAYEE_SUGGESTIONS).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 wide:grid-cols-2">
            <TextField label={s.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            {editing ? null : (
              <SelectField
                label={strings.recurring.repeat}
                value={repeat}
                onChange={(v) => setRepeat(v as Repeat)}
                items={REPEAT_OPTIONS.map((option) => ({ value: option, label: strings.recurring.frequencies[option] }))}
              />
            )}
          </div>

          {save.isError ? <Alert tone="error">{errorMessage(save.error)}</Alert> : null}
          {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}

          <div className="flex items-center gap-3">
            {editing ? (
              <Button
                variant="ghost"
                className="text-expense-strong"
                icon={<Trash2 aria-hidden="true" className="size-4" />}
                onClick={() => {
                  deleteWithUndo(transaction);
                  onClose();
                }}
                disabled={!online}
              >
                {s.delete}
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="flex-1" loading={save.isPending} disabled={!online}>
              {editing ? s.saveChanges : s.save[kind]}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
