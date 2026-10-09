// Money math for display and form previews (spec section 5). Pure TypeScript, no React.
//
// Rules shared with SQL (private.round_half_even / private.convert_minor):
//   * Amounts are integers in minor units (cents, paise); exponent from public.currencies.
//   * Rates are exact decimal strings: 1 unit of the source currency = rate units of the target.
//   * Converted amounts round half-even to the target currency's minor unit.
//   * Derived rates round half-even to RATE_DECIMALS places.

import BigJs from 'big.js';

// A private Big constructor so settings can't leak in from elsewhere. Strict mode makes Big throw
// if a JS number is passed in, so binary floating point never enters money math.
const Big = BigJs();
Big.DP = 40;
Big.RM = Big.roundHalfEven;
Big.NE = -60;
Big.PE = 60;
Big.strict = true;

/** Matches private.rate_scale() in SQL (DECISIONS.md). */
export const RATE_DECIMALS = 12;
/** Rates are shown to this many significant digits. */
export const RATE_DISPLAY_SIGNIFICANT_DIGITS = 6;

const TEN = Big('10');

function assertMinor(minor: number): void {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Not a safe integer amount: ${minor}`);
}

function scale(exponent: number) {
  return TEN.pow(exponent);
}

/** Minor units to an exact decimal string: (12345, 2) -> "123.45", (5, 3) -> "0.005", (7, 0) -> "7". */
export function minorToDecimal(minor: number, exponent: number): string {
  assertMinor(minor);
  return Big(String(minor)).div(scale(exponent)).toFixed(exponent);
}

/**
 * Parses an amount the user typed into minor units. Accepts "." or "," as the decimal separator
 * (no grouping separators). Returns null for anything that isn't a valid amount for this
 * currency, including more decimals than it has.
 */
export function parseAmount(input: string, exponent: number): number | null {
  const text = input.replace(/\s/g, '').replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const decimals = text.split('.')[1] ?? '';
  if (decimals.length > exponent) return null;
  const minor = Number(Big(text).times(scale(exponent)).toFixed(0));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units as an editable input value: (12050, 2) -> "120.50". */
export function amountInputValue(minor: number, exponent: number): string {
  return minorToDecimal(minor, exponent);
}

/** Converts minor units at `rate`, rounding half-even to the target minor unit. */
export function convertMinor(amountMinor: number, rate: string, fromExponent: number, toExponent: number): number {
  assertMinor(amountMinor);
  const result = Big(String(amountMinor))
    .times(Big(rate))
    .times(scale(toExponent - fromExponent))
    .round(0, Big.roundHalfEven);
  return Number(result.toFixed(0));
}

/**
 * The rate implied by a converted amount the user typed: converted / original, rounded
 * half-even to RATE_DECIMALS places. Null when the original amount is zero or the result
 * would be zero.
 */
export function deriveRate(
  originalMinor: number,
  fromExponent: number,
  convertedMinor: number,
  toExponent: number,
): string | null {
  assertMinor(originalMinor);
  assertMinor(convertedMinor);
  if (originalMinor <= 0 || convertedMinor <= 0) return null;
  const rate = Big(minorToDecimal(convertedMinor, toExponent))
    .div(Big(minorToDecimal(originalMinor, fromExponent)))
    .round(RATE_DECIMALS, Big.roundHalfEven);
  return rate.gt(Big('0')) ? rate.toString() : null;
}

/**
 * Parses a rate the user typed: a positive decimal, rounded half-even to RATE_DECIMALS places.
 * Accepts "." or ",". Returns the normalized string or null.
 */
export function parseRate(input: string): string | null {
  const text = input.replace(/\s/g, '').replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const rate = Big(text).round(RATE_DECIMALS, Big.roundHalfEven);
  return rate.gt(Big('0')) ? rate.toString() : null;
}

/**
 * A rate rounded for an input field the user hasn't typed into: RATE_DISPLAY_SIGNIFICANT_DIGITS
 * significant digits, no grouping ("96.644055694395" -> "96.6441"). The exact rate is still what
 * gets saved unless the user edits the field.
 */
export function rateForInput(rate: string): string {
  return Big(rate).prec(RATE_DISPLAY_SIGNIFICANT_DIGITS, Big.roundHalfEven).toString();
}

/** Normalizes a rate from the database ("90.000000000000" -> "90"). */
export function normalizeRate(rate: string): string {
  return Big(rate).toString();
}

// Intl formatters are relatively expensive to build; long lists reuse them.
const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale ?? ''}|${key}`;
  let cached = formatterCache.get(cacheKey);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, options);
    formatterCache.set(cacheKey, cached);
  }
  return cached;
}

export type SignDisplay = 'auto' | 'always' | 'exceptZero' | 'never';

/**
 * Formats minor units as currency, always with the currency's own number of decimals
 * (ISO 4217 exponent, which can differ from the locale's default for that currency).
 * Formats the exact decimal string, never a float.
 */
export function formatMoney(
  minor: number,
  currency: string,
  exponent: number,
  options: { locale?: string; sign?: SignDisplay } = {},
): string {
  const sign = options.sign ?? 'auto';
  const fmt = formatter(`money|${currency}|${exponent}|${sign}`, options.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    signDisplay: sign,
  });
  return fmt.format(minorToDecimal(minor, exponent) as Intl.StringNumericLiteral);
}

/** Short form for chart axes: "₹1.2L", "$15K". */
export function formatMoneyCompact(minor: number, currency: string, exponent: number, locale?: string): string {
  const fmt = formatter(`compact|${currency}`, locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return fmt.format(minorToDecimal(minor, exponent) as Intl.StringNumericLiteral);
}

/** A transaction amount with its sign: expenses negative, income positive (the non-color cue). */
export function formatSignedMoney(
  type: 'expense' | 'income',
  minor: number,
  currency: string,
  exponent: number,
  locale?: string,
): string {
  return formatMoney(type === 'expense' ? -minor : minor, currency, exponent, {
    sign: 'exceptZero',
    ...(locale ? { locale } : {}),
  });
}

/** A rate for display, to RATE_DISPLAY_SIGNIFICANT_DIGITS significant digits. */
export function formatRate(rate: string, locale?: string): string {
  const fmt = formatter('rate', locale, { maximumSignificantDigits: RATE_DISPLAY_SIGNIFICANT_DIGITS });
  return fmt.format(rate as Intl.StringNumericLiteral);
}
