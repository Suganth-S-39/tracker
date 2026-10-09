import { useState } from 'react';
import { NO_EDITS, editsAfterAmountChange, resolveConversion, type ConversionEdits } from '@/domain/conversion';
import { normalizeRate } from '@/domain/money';
import { useLatestRate } from './rates';

type UseConversionInput = {
  amountMinor: number | null;
  currency: string;
  /** The currency converted into (the base currency, or an IOU's currency for repayments). */
  target: string;
  exponentOf: (code: string) => number;
  /** When editing a saved record: its rate, used instead of today's while the currency is unchanged. */
  stored?: { currency: string; rate: string } | undefined;
};

/** State for the editable rate / converted-amount pair (spec section 8). Logic: src/domain/conversion. */
export function useConversion({ amountMinor, currency, target, exponentOf, stored }: UseConversionInput) {
  const [edits, setEdits] = useState<ConversionEdits>(NO_EDITS);
  const sameCurrency = currency === target;
  const latest = useLatestRate(currency, target, !sameCurrency);
  const usingStoredRate = stored !== undefined && stored.currency === currency;

  const conversion = resolveConversion({
    ...edits,
    amountMinor,
    fromExponent: exponentOf(currency),
    toExponent: exponentOf(target),
    sameCurrency,
    latestRate: usingStoredRate ? normalizeRate(stored.rate) : (latest.data?.rate ?? null),
  });

  return {
    conversion,
    sameCurrency,
    latest,
    usingStoredRate,
    target,
    currency,
    setRateText: (rateText: string) => setEdits({ rateText, convertedText: null }),
    setConvertedText: (convertedText: string) => setEdits({ rateText: null, convertedText }),
    /** Call after the amount changes: keeps a typed converted amount's rate instead of the amount. */
    amountChanged: () => setEdits((current) => editsAfterAmountChange(current, conversion)),
    reset: () => setEdits(NO_EDITS),
  };
}

export type ConversionState = ReturnType<typeof useConversion>;
