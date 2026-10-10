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
import { openGoals, useGoals, type Goal } from '@/features/goals/api';
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
import { ENTRY_KINDS, type EntryKind } from './kinds';

/** How many recent payees the "Paid to" field suggests. */
const PAYEE_SUGGESTIONS = 50;

type Repeat = NonNullable<TransactionInput['repeat']> | 'none';
const REPEAT_OPTIONS: readonly Repeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

type TransactionFormProps = {
  money: MoneyContext;
  categories: readonly Category[];
  transaction?: Transaction | undefined;
  initialKind?: EditorKind | undefined;
  /** Savings into this goal (the goal page's Add money). */
  initialGoalId?: string | undefined;
  onClose: () => void;
};

const s = strings.form;

/**
 * The goal picker's choices: no goal, then every open goal. A goal the transaction already belongs
 * to that's since been bought or deleted stays listed, so editing a note doesn't unlink it.
 */
function goalItems(goals: readonly Goal[], transaction: Transaction | undefined) {
  const items = [{ value: '', label: s.noGoal }, ...openGoals(goals).map((goal) => ({ value: goal.id, label: goal.name }))];
  const current = transaction?.goal_id;
  if (current && !items.some((item) => item.value === current)) {
    const name = goals.find((goal) => goal.id === current)?.name ?? transaction.goal_name;
    items.push({ value: current, label: name ? s.closedGoal(name) : s.deletedGoal });
  }
  return items;
}

/**
 * Add / edit form (spec section 8): Expense / Income / Savings / Investment / IOU. The amount is
 * focused on open (not on touch screens); foreign currencies show an editable rate and converted
 * amount; new transactions can repeat; savings can go into a goal.
 */
export function TransactionForm({
  money,
  categories,
  transaction,
  initialKind = 'expense',
  initialGoalId,
  onClose,
}: TransactionFormProps) {
  const editing = transaction !== undefined;
  const { baseCurrency, exponentOf } = money;

  // Withdrawals never reach this form (they open their goal).
  const [kind, setKind] = useState<EditorKind>(transaction && transaction.type !== 'withdrawal' ? transaction.type : initialKind);
  const [currency, setCurrency] = useState(transaction?.original_currency ?? baseCurrency);
  const [amountText, setAmountText] = useState(
    transaction ? amountInputValue(transaction.original_amount_minor, exponentOf(transaction.original_currency)) : '',
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '');
  const [date, setDate] = useState(transaction?.date ?? todayLocal());
  const [payee, setPayee] = useState(transaction?.payee ?? '');
  const [note, setNote] = useState(transaction?.note ?? '');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [goalId, setGoalId] = useState(transaction?.goal_id ?? initialGoalId ?? '');
  // Editing without touching amount, currency or rate saves the stored values unchanged.
  const [moneyTouched, setMoneyTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const online = useOnlineStatus();
  const toast = useToast();
  const save = useSaveTransaction();
  const deleteWithUndo = useDeleteWithUndo();
  const payees = useRecentPayees();
  // Only for savings: fetching (and re-rendering) as the sheet slides in would cost frames for
  // the other tabs, which never show goals.
  const goals = useGoals({ enabled: kind === 'savings' });

  const amountMinor = parseAmount(amountText, exponentOf(currency));
  const conversion = useConversion({
    amountMinor,
    currency,
    target: baseCurrency,
    exponentOf,
    stored: transaction ? { currency: transaction.original_currency, rate: transaction.exchange_rate } : undefined,
  });

  const type: EntryKind = kind === 'iou' ? 'expense' : kind;
  // Goals take savings only; the choice is kept while switching tabs but only sent for savings.
  const savingsGoal = kind === 'savings' && goalId !== '' ? goalId : undefined;
  const goalChoices = goalItems(goals.data ?? [], transaction);
  const showGoal = kind === 'savings' && goalChoices.length > 1;
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
          // Savings for a goal don't repeat (the database says so too).
          repeat: !editing && repeat !== 'none' && !savingsGoal ? repeat : undefined,
          goalId: savingsGoal,
        },
      },
      {
        onSuccess: () => {
          const goalName = savingsGoal ? goalChoices.find((item) => item.value === savingsGoal)?.label : undefined;
          toast({
            message: editing
              ? strings.transactions.updated
              : goalName
                ? strings.goals.addedTo(goalName)
                : strings.transactions.added[type],
          });
          onClose();
        },
      },
    );
  }

  const payeeListId = useId();
  const kindOptions = (editing ? ENTRY_KINDS : [...ENTRY_KINDS, 'iou' as const]).map((value) => ({
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
            tone={type}
            autoFocus
            error={shown(errors.amount)}
          />

          <ConversionPanel state={conversion} showErrors={showErrors} onEdit={() => setMoneyTouched(true)} />

          {showGoal ? (
            <SelectField label={s.goal} value={goalId} onChange={setGoalId} items={goalChoices} />
          ) : null}

          <div>
            <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} error={shown(errors.category)} />
            <Link to="/settings/categories" onClick={onClose} className="mt-2 inline-block text-sm font-semibold text-accent-strong hover:underline">
              {s.manageCategories}
            </Link>
          </div>

          <div className="grid gap-4 wide:grid-cols-2">
            <TextField label={s.date} type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
            <TextField
              label={s.payee[type]}
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
            {editing || savingsGoal ? null : (
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
              {editing ? s.saveChanges : s.save[type]}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
