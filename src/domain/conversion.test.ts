import { describe, expect, it } from 'vitest';
import { NO_EDITS, editsAfterAmountChange, resolveConversion, type ConversionInput } from './conversion';

// USD (2 decimals) -> INR (2 decimals), latest rate 83.25.
const base: ConversionInput = {
  ...NO_EDITS,
  amountMinor: 10000, // USD 100.00
  fromExponent: 2,
  toExponent: 2,
  sameCurrency: false,
  latestRate: '83.250000000000',
};

describe('resolveConversion', () => {
  it('in the base currency: rate 1 and the same amount', () => {
    const result = resolveConversion({ ...base, sameCurrency: true });
    expect(result).toMatchObject({ rate: '1', convertedMinor: 10000, convertedField: '100.00', source: 'same-currency' });
  });

  it('starts from the latest rate', () => {
    expect(resolveConversion(base)).toMatchObject({
      rateField: '83.25',
      convertedField: '8325.00',
      rate: '83.25',
      convertedMinor: 832500,
      invalid: null,
      source: 'latest',
    });
  });

  it('recalculates the converted amount when the rate is edited', () => {
    expect(resolveConversion({ ...base, rateText: '84' })).toMatchObject({
      rateField: '84',
      convertedField: '8400.00',
      rate: '84',
      convertedMinor: 840000,
      source: 'rate-edited',
    });
  });

  it('recalculates the rate when the converted amount is edited', () => {
    expect(resolveConversion({ ...base, convertedText: '8300' })).toMatchObject({
      rateField: '83',
      convertedField: '8300',
      rate: '83',
      convertedMinor: 830000,
      source: 'converted-edited',
    });
  });

  it('derives a 12-decimal rate from an awkward converted amount, and shows it rounded', () => {
    const result = resolveConversion({ ...base, amountMinor: 300, convertedText: '100' });
    expect(result.rate).toBe('33.333333333333');
    expect(result.rateField).toBe('33.3333');
    expect(result.convertedMinor).toBe(10000);
  });

  it('shows a long latest rate rounded but converts with the exact one', () => {
    const result = resolveConversion({ ...base, latestRate: '96.644055694395' });
    expect(result.rateField).toBe('96.6441');
    expect(result.rate).toBe('96.644055694395');
    expect(result.convertedMinor).toBe(966441); // 100 x 96.644055694395 = 9664.4055... -> 9664.41
  });

  it('handles 0- and 3-decimal currencies (JPY -> KWD)', () => {
    const result = resolveConversion({
      ...base,
      amountMinor: 10000, // JPY 10000
      fromExponent: 0,
      toExponent: 3,
      latestRate: '0.002063',
    });
    expect(result).toMatchObject({ convertedMinor: 20630, convertedField: '20.630' });
  });

  it('flags an invalid rate', () => {
    expect(resolveConversion({ ...base, rateText: 'abc' })).toMatchObject({ rate: null, invalid: 'rate', convertedField: '' });
    expect(resolveConversion({ ...base, rateText: '0' })).toMatchObject({ invalid: 'rate' });
  });

  it('flags an invalid converted amount', () => {
    expect(resolveConversion({ ...base, convertedText: '12.345' })).toMatchObject({ invalid: 'converted' });
    expect(resolveConversion({ ...base, convertedText: '0' })).toMatchObject({ invalid: 'converted' });
  });

  it('asks for a rate when none is known', () => {
    expect(resolveConversion({ ...base, latestRate: null })).toMatchObject({
      rate: null,
      rateField: '',
      invalid: 'rate',
      source: 'none',
    });
  });

  it('waits for an amount before converting', () => {
    expect(resolveConversion({ ...base, amountMinor: null })).toMatchObject({ rate: '83.25', convertedField: '', convertedMinor: null });
  });
});

describe('editsAfterAmountChange', () => {
  it('keeps the rate implied by a typed converted amount', () => {
    const edits = { rateText: null, convertedText: '8300' };
    const current = resolveConversion({ ...base, ...edits });
    expect(editsAfterAmountChange(edits, current)).toEqual({ rateText: '83', convertedText: null });
  });

  it('leaves rate edits alone', () => {
    const edits = { rateText: '84', convertedText: null };
    expect(editsAfterAmountChange(edits, resolveConversion({ ...base, ...edits }))).toBe(edits);
  });
});
