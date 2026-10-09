import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { AmountField } from '@/features/money/AmountField';
import { ConversionPanel } from '@/features/money/ConversionPanel';
import { useLatestRate } from '@/features/money/rates';
import { useConversion } from '@/features/money/useConversion';
import type { MoneyContext } from '@/features/money/useMoney';
import { isIsoDate, todayLocal } from '@/domain/dates';
import { repayableMinor, repaymentBaseRate } from '@/domain/iou';
import { amountInputValue, convertMinor, formatMoney, parseAmount } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useSaveRepayment, type Iou, type Repayment } from './api';

const s = strings.ious.repayment;

type RepaymentFormProps = {
  iou: Iou;
  money: MoneyContext;
  repayment?: Repayment | undefined;
  onClose: () => void;
};

/**
 * Records money paid back, in any currency (spec section 8). When it differs from the IOU's
 * currency, the same editable rate / converted-amount control converts it into the IOU's
 * currency. It can't exceed what is still owed: checked here and enforced by the database.
 */
export function RepaymentForm({ iou, money, repayment, onClose }: RepaymentFormProps) {
  const editing = repayment !== undefined;
  const { baseCurrency, exponentOf } = money;
  const iouCurrency = iou.original_currency;
  const repayable = repayableMinor(iou.remaining_minor, repayment?.iou_currency_amount_minor ?? 0);

  const [currency, setCurrency] = useState(repayment?.currency ?? iouCurrency);
  const [amountText, setAmountText] = useState(
    repayment ? amountInputValue(repayment.amount_minor, exponentOf(repayment.currency)) : '',
  );
  const [date, setDate] = useState(repayment?.date ?? todayLocal());
  const [note, setNote] = useState(repayment?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const online = useOnlineStatus();
  const toast = useToast();
  const save = useSaveRepayment();

  const amountMinor = parseAmount(amountText, exponentOf(currency));
  // Repayment currency -> IOU currency (editable).
  const toIou = useConversion({
    amountMinor,
    currency,
    target: iouCurrency,
    exponentOf,
    stored: repayment ? { currency: repayment.currency, rate: repayment.iou_currency_rate } : undefined,
  });
  // Repayment currency -> base, only needed when all three currencies differ.
  const needsLatestToBase = currency !== baseCurrency && iouCurrency !== baseCurrency;
  const latestToBase = useLatestRate(currency, baseCurrency, needsLatestToBase);

  const iouAmountMinor = toIou.conversion.convertedMinor;
  const baseRate = repaymentBaseRate({
    repaymentCurrency: currency,
    iouCurrency,
    baseCurrency,
    iouRate: toIou.conversion.rate,
    latestToBase: latestToBase.data?.rate ?? null,
  });
  // When the IOU is in the base currency, the converted IOU amount is the base amount, exactly.
  const baseAmountMinor =
    amountMinor === null || baseRate === null
      ? null
      : iouCurrency === baseCurrency
        ? iouAmountMinor
        : convertMinor(amountMinor, baseRate, exponentOf(currency), exponentOf(baseCurrency));

  const fmtIou = (minor: number) => formatMoney(minor, iouCurrency, exponentOf(iouCurrency));
  const errors = {
    amount:
      amountText.trim() !== '' && amountMinor === null
        ? strings.form.errors.amountFormat(exponentOf(currency))
        : !amountMinor
          ? strings.form.errors.amount
          : iouAmountMinor !== null && iouAmountMinor > repayable
            ? s.errors.exceeds(fmtIou(repayable))
            : undefined,
    conversion: toIou.conversion.invalid ?? undefined,
    base: amountMinor !== null && baseRate === null && !latestToBase.isPending ? s.errors.noBaseRate : undefined,
    date: !isIsoDate(date) ? strings.form.errors.date : date < iou.date ? s.errors.beforeIou : undefined,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

  function repayTheRest() {
    setCurrency(iouCurrency);
    setAmountText(amountInputValue(repayable, exponentOf(iouCurrency)));
    toIou.reset();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || amountMinor === null || iouAmountMinor === null || baseAmountMinor === null) return;
    const iouRate = toIou.conversion.rate;
    if (iouRate === null || baseRate === null) return;

    save.mutate(
      {
        iouId: iou.id,
        ...(editing ? { id: repayment.id } : {}),
        input: {
          amountMinor,
          currency,
          iouCurrencyAmountMinor: iouAmountMinor,
          iouCurrencyRate: iouRate,
          baseAmountMinor,
          exchangeRate: baseRate,
          date,
          note,
        },
      },
      {
        onSuccess: () => {
          toast({ message: editing ? strings.ious.repaymentUpdated : strings.ious.repaymentRecorded });
          onClose();
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 rounded-control bg-control px-4 py-3">
        <span className="text-sm font-medium tabular">{s.remaining(fmtIou(repayable))}</span>
        {repayable > 0 ? (
          <Button variant="ghost" className="h-9 text-accent-strong" onClick={repayTheRest}>
            {s.repayRest}
          </Button>
        ) : null}
      </div>

      <AmountField
        label={s.amount}
        amountText={amountText}
        onAmountChange={(text) => {
          setAmountText(text);
          toIou.amountChanged();
        }}
        currency={currency}
        onCurrencyChange={(code) => {
          setCurrency(code);
          toIou.reset();
        }}
        money={money}
        tone={iou.direction === 'lent' ? 'income' : 'expense'}
        autoFocus
        error={shown(errors.amount)}
      />

      <ConversionPanel state={toIou} showErrors={showErrors} />

      {currency !== baseCurrency && iouCurrency !== baseCurrency && baseAmountMinor !== null ? (
        <p className="text-sm text-fg-muted tabular">
          {s.inBase(formatMoney(baseAmountMinor, baseCurrency, exponentOf(baseCurrency)))}
        </p>
      ) : null}
      {shown(errors.base) ? <Alert tone="error">{errors.base}</Alert> : null}

      <TextField label={s.date} type="date" required min={iou.date} value={date} onChange={(e) => setDate(e.target.value)} error={shown(errors.date)} />
      <TextField label={strings.form.note} hint={strings.common.optional} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

      {save.isError ? <Alert tone="error">{errorMessage(save.error)}</Alert> : null}
      {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}

      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!online}>
        {s.save}
      </Button>
    </form>
  );
}
