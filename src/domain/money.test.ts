import { describe, expect, it } from 'vitest';
import {
  convertMinor,
  deriveRate,
  formatMoney,
  formatRate,
  formatSignedMoney,
  minorToDecimal,
  normalizeRate,
  parseAmount,
  parseRate,
} from './money';

// Exponents: JPY 0, USD/INR 2, KWD 3.

describe('minorToDecimal', () => {
  it.each([
    [12345, 2, '123.45'],
    [5, 2, '0.05'],
    [5, 3, '0.005'],
    [1234, 0, '1234'],
    [-12345, 2, '-123.45'],
    [0, 3, '0.000'],
  ])('%i at exponent %i -> %s', (minor, exponent, expected) => {
    expect(minorToDecimal(minor, exponent)).toBe(expected);
  });

  it('rejects non-integers', () => {
    expect(() => minorToDecimal(1.5, 2)).toThrow(RangeError);
  });
});

describe('parseAmount', () => {
  it.each([
    ['120.5', 2, 12050],
    ['120,50', 2, 12050],
    [' 1 000 ', 2, 100000],
    ['.5', 2, 50],
    ['7.', 2, 700],
    ['1250', 0, 1250],
    ['3.075', 3, 3075],
    ['0', 2, 0],
  ])('"%s" at exponent %i -> %i', (input, exponent, expected) => {
    expect(parseAmount(input, exponent)).toBe(expected);
  });

  it.each([
    ['1.234', 2],
    ['12.5', 0],
    ['abc', 2],
    ['', 2],
    ['1.2.3', 2],
    ['-5', 2],
    ['1,234.56', 2],
    ['1e5', 2],
  ])('"%s" at exponent %i is invalid', (input, exponent) => {
    expect(parseAmount(input, exponent)).toBeNull();
  });

  it('rejects amounts beyond safe integers', () => {
    expect(parseAmount('99999999999999999', 2)).toBeNull();
  });
});

describe('convertMinor (half-even, same cases as the SQL tests)', () => {
  it.each([
    // [amount, rate, fromExp, toExp, expected, description]
    [1000, '0.30705', 2, 3, 3070, 'USD 10.00 -> KWD 3.0705 rounds to the even 3.070'],
    [1000, '0.30715', 2, 3, 3072, 'USD 10.00 -> KWD 3.0715 rounds to the even 3.072'],
    [1250, '0.0067', 0, 2, 838, 'JPY 1250 -> USD 8.375 rounds to the even 8.38'],
    [999, '154.123', 2, 0, 1540, 'USD 9.99 -> JPY 1539.69 rounds to 1540'],
    [25, '0.1', 2, 2, 2, '0.25 x 0.1 = 0.025 -> 0.02 (half to even)'],
    [35, '0.1', 2, 2, 4, '0.35 x 0.1 = 0.035 -> 0.04 (half to even)'],
    [12345, '1', 2, 2, 12345, 'rate 1 keeps the amount'],
    [10000, '90.123456789012', 2, 2, 901235, 'a 12-decimal rate is exact'],
  ])('%i at %s (%i -> %i decimals) = %i: %s', (amount, rate, from, to, expected) => {
    expect(convertMinor(amount, rate, from, to)).toBe(expected);
  });

  it('never goes through floating point', () => {
    // 0.1 + 0.2 style errors would give 30000000000000004 here.
    expect(convertMinor(30000000000000, '1.000000000000', 2, 2)).toBe(30000000000000);
    expect(convertMinor(1, '0.29', 2, 2)).toBe(0);
  });
});

describe('deriveRate (editing the converted amount)', () => {
  it('is converted / original, rounded half-even to 12 places', () => {
    expect(deriveRate(10000, 2, 901235, 2)).toBe('90.1235');
    expect(deriveRate(300, 2, 100, 2)).toBe('0.333333333333');
    expect(deriveRate(600, 2, 400, 2)).toBe('0.666666666667');
  });

  it('works across exponents', () => {
    expect(deriveRate(1000, 0, 670, 2)).toBe('0.0067'); // JPY 1000 -> USD 6.70
    expect(deriveRate(1000, 2, 3070, 3)).toBe('0.307'); // USD 10.00 -> KWD 3.070
  });

  it('round-trips: converting at the derived rate gives back the typed amount', () => {
    for (const [original, converted] of [
      [12345, 1000003],
      [1, 9999999],
      [9999999, 1],
      [700, 333],
    ] as const) {
      const rate = deriveRate(original, 2, converted, 2)!;
      expect(Math.abs(convertMinor(original, rate, 2, 2) - converted)).toBeLessThanOrEqual(1);
    }
  });

  it('is null for zero amounts', () => {
    expect(deriveRate(0, 2, 100, 2)).toBeNull();
    expect(deriveRate(100, 2, 0, 2)).toBeNull();
  });
});

describe('parseRate and normalizeRate', () => {
  it.each([
    ['83.12', '83.12'],
    ['83,12', '83.12'],
    ['0.0000123456789012345', '0.000012345679'],
    ['1.0000000000005', '1'],
    ['1.0000000000015', '1.000000000002'],
  ])('"%s" -> %s', (input, expected) => {
    expect(parseRate(input)).toBe(expected);
  });

  it.each([['0'], ['-1'], ['abc'], [''], ['0.0000000000001']])('"%s" is invalid', (input) => {
    expect(parseRate(input)).toBeNull();
  });

  it('normalizes database text', () => {
    expect(normalizeRate('90.000000000000')).toBe('90');
    expect(normalizeRate('0.884955752212')).toBe('0.884955752212');
  });
});

describe('formatting', () => {
  it('uses the ISO exponent for decimals', () => {
    expect(formatMoney(12345, 'USD', 2, { locale: 'en-US' })).toBe('$123.45');
    expect(formatMoney(1234, 'JPY', 0, { locale: 'en-US' })).toBe('¥1,234');
    // Intl separates a currency code from the number with a no-break space.
    expect(formatMoney(3075, 'KWD', 3, { locale: 'en-US' })).toBe('KWD 3.075');
    expect(formatMoney(1234567, 'INR', 2, { locale: 'en-IN' })).toBe('₹12,345.67');
  });

  it('pairs expense and income with a sign', () => {
    expect(formatSignedMoney('expense', 12050, 'USD', 2, 'en-US')).toBe('-$120.50');
    expect(formatSignedMoney('income', 12050, 'USD', 2, 'en-US')).toBe('+$120.50');
  });

  it('formats huge amounts exactly', () => {
    expect(formatMoney(9007199254740991, 'USD', 2, { locale: 'en-US' })).toBe('$90,071,992,547,409.91');
  });

  it('shows rates to 6 significant digits', () => {
    expect(formatRate('90.123456789012', 'en-US')).toBe('90.1235');
    expect(formatRate('0.000012345679', 'en-US')).toBe('0.0000123457');
    expect(formatRate('1', 'en-US')).toBe('1');
  });
});
