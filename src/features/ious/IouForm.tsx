import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toast-context';
import { AmountField } from '@/features/money/AmountField';
import { ConversionPanel } from '@/features/money/ConversionPanel';
import { useConversion } from '@/features/money/useConversion';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate, todayLocal } from '@/domain/dates';
import { amountInputValue, formatMoney, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useSaveIou, type Iou, type IouDirection } from './api';

const s = strings.ious.form;

type IouFormProps = {
  money: MoneyContext;
  /** Editing an existing IOU; omit to create one. */
  iou?: Iou | undefined;
  onClose: () => void;
};

/**
 * Lend or borrow (spec section 8): person, direction, amount and currency, date, optional due date
 * and note. The IOU and its linked transaction are saved together by one database function.
 */
export function IouForm({ money, iou, onClose }: IouFormProps) {
  const editing = iou !== undefined;
  const locked = editing && iou.repayment_count > 0;
  const { baseCurrency, exponentOf } = money;

  const [person, setPerson] = useState(iou?.person_name ?? '');
  const [direction, setDirection] = useState<IouDirection>(iou?.direction ?? 'lent');
  const [currency, setCurrency] = useState(iou?.original_currency ?? baseCurrency);
  const [amountText, setAmountText] = useState(
    iou ? amountInputValue(iou.original_amount_minor, exponentOf(iou.original_currency)) : '',
  );
  const [date, setDate] = useState(iou?.date ?? todayLocal());
  const [dueDate, setDueDate] = useState(iou?.due_date ?? '');
  const [note, setNote] = useState(iou?.note ?? '');
  const [moneyTouched, setMoneyTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const online = useOnlineStatus();
  const toast = useToast();
  const navigate = useNavigate();
  const save = useSaveIou();

  const amountMinor = parseAmount(amountText, exponentOf(currency));
  const conversion = useConversion({
    amountMinor,
    currency,
    target: baseCurrency,
    exponentOf,
    stored: iou ? { currency: iou.original_currency, rate: iou.exchange_rate } : undefined,
  });

  const repaid = iou?.repaid_minor ?? 0;
  const errors = {
    person: person.trim().length === 0 || person.trim().length > 80 ? s.errors.person : undefined,
    amount:
      amountText.trim() !== '' && amountMinor === null
        ? strings.form.errors.amountFormat(exponentOf(currency))
        : !amountMinor
          ? strings.form.errors.amount
          : amountMinor < repaid
            ? s.errors.belowRepaid(formatMoney(repaid, currency, exponentOf(currency)))
            : undefined,
    date: isIsoDate(date) ? undefined : strings.form.errors.date,
    dueDate: dueDate && (!isIsoDate(dueDate) || dueDate < date) ? s.errors.dueDate : undefined,
    conversion: conversion.conversion.invalid ?? undefined,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || amountMinor === null) return;

    const keepStored = editing && !moneyTouched;
    const exchangeRate = keepStored ? iou.exchange_rate : conversion.conversion.rate;
    const baseAmountMinor = keepStored ? iou.base_amount_minor : conversion.conversion.convertedMinor;
    if (exchangeRate === null || baseAmountMinor === null) return;

    save.mutate(
      {
        ...(editing ? { id: iou.id } : {}),
        input: {
          personName: person,
          direction,
          originalAmountMinor: amountMinor,
          originalCurrency: currency,
          exchangeRate,
          baseAmountMinor,
          date,
          dueDate: dueDate || null,
          note,
        },
      },
      {
        onSuccess: (id) => {
          toast(
            editing
              ? { message: strings.ious.updated }
              : { message: strings.ious.added, action: { label: strings.ious.view, onAction: () => void navigate(`/ious/${id}`) } },
          );
          onClose();
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <TextField
        label={s.person}
        autoComplete="off"
        maxLength={80}
        data-autofocus={editing || undefined}
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        error={shown(errors.person)}
      />

      {locked ? (
        <p className="text-sm text-fg-muted">{s.lockedHint}</p>
      ) : (
        <SegmentedControl
          label={s.direction}
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'lent', label: s.directions.lent },
            { value: 'borrowed', label: s.directions.borrowed },
          ]}
        />
      )}

      <AmountField
        label={strings.form.amount}
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
        currencyLocked={locked}
        money={money}
        tone={direction === 'lent' ? 'expense' : 'income'}
        error={shown(errors.amount)}
      />

      <ConversionPanel state={conversion} showErrors={showErrors} onEdit={() => setMoneyTouched(true)} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label={s.date} type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
        <TextField
          label={s.dueDate}
          hint={strings.common.optional}
          type="date"
          min={date}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          error={shown(errors.dueDate)}
        />
      </div>

      <TextField label={strings.form.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

      {save.isError ? <Alert tone="error">{errorMessage(save.error)}</Alert> : null}
      {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}

      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!online}>
        {editing ? strings.form.saveChanges : s.save}
      </Button>
    </form>
  );
}
