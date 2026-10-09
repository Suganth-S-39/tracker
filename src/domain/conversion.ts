// The Add form's conversion control (spec section 8): when the currency differs from the base
// currency, show the converted amount and the rate; the user can edit either, and the other one
// recalculates. Pure logic, no React.

import { amountInputValue, convertMinor, deriveRate, normalizeRate, parseAmount, parseRate, rateForInput } from './money';

/** What the user has typed into the two conversion fields (null = not edited). */
export type ConversionEdits = {
  rateText: string | null;
  convertedText: string | null;
};

export const NO_EDITS: ConversionEdits = { rateText: null, convertedText: null };

export type ConversionInput = ConversionEdits & {
  amountMinor: number | null;
  fromExponent: number;
  toExponent: number;
  sameCurrency: boolean;
  /** Latest known rate from the database, or null if none. */
  latestRate: string | null;
};

export type Conversion = {
  /** Values to show in the two fields. */
  rateField: string;
  convertedField: string;
  /** What gets saved. Null when it can't be worked out yet. */
  rate: string | null;
  convertedMinor: number | null;
  /** Which field is invalid, if any. */
  invalid: 'rate' | 'converted' | null;
  /** Where the rate came from. */
  source: 'same-currency' | 'latest' | 'rate-edited' | 'converted-edited' | 'none';
};

export function resolveConversion(input: ConversionInput): Conversion {
  const { amountMinor, fromExponent, toExponent } = input;

  if (input.sameCurrency) {
    return {
      rateField: '1',
      convertedField: amountMinor === null ? '' : amountInputValue(amountMinor, toExponent),
      rate: '1',
      convertedMinor: amountMinor,
      invalid: null,
      source: 'same-currency',
    };
  }

  // The user typed the converted amount: the rate follows from it.
  if (input.convertedText !== null) {
    const convertedMinor = parseAmount(input.convertedText, toExponent);
    const rate =
      amountMinor !== null && convertedMinor !== null
        ? deriveRate(amountMinor, fromExponent, convertedMinor, toExponent)
        : null;
    return {
      rateField: rate ? rateForInput(rate) : '',
      convertedField: input.convertedText,
      rate,
      convertedMinor,
      invalid: convertedMinor === null || convertedMinor <= 0 ? 'converted' : null,
      source: 'converted-edited',
    };
  }

  // Otherwise the rate drives: the user's rate if they typed one, else the latest rate.
  const edited = input.rateText !== null;
  const rate = edited ? parseRate(input.rateText ?? '') : input.latestRate ? normalizeRate(input.latestRate) : null;
  const convertedMinor =
    amountMinor !== null && rate !== null ? convertMinor(amountMinor, rate, fromExponent, toExponent) : null;
  return {
    rateField: edited ? (input.rateText ?? '') : rate ? rateForInput(rate) : '',
    convertedField: convertedMinor === null ? '' : amountInputValue(convertedMinor, toExponent),
    rate,
    convertedMinor,
    invalid: rate === null ? 'rate' : null,
    source: edited ? 'rate-edited' : rate ? 'latest' : 'none',
  };
}

/**
 * When the amount changes after the user typed a converted amount, keep the rate that amount
 * implied (instead of the stale converted amount) so the converted value follows the new amount.
 */
export function editsAfterAmountChange(edits: ConversionEdits, current: Conversion): ConversionEdits {
  if (edits.convertedText !== null && current.rate !== null) {
    return { rateText: current.rate, convertedText: null };
  }
  return edits;
}
