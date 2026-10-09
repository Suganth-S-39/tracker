import { describe, expect, it } from 'vitest';
import { defaultCurrencyForLocale, regionFromLocale } from './regionCurrency';

const supported = new Set(['INR', 'USD', 'EUR', 'JPY', 'GBP', 'KWD', 'CHF']);

describe('regionFromLocale', () => {
  it('reads the region subtag', () => {
    expect(regionFromLocale('en-IN')).toBe('IN');
    expect(regionFromLocale('de-CH')).toBe('CH');
  });

  it('infers the likely region when the locale has none', () => {
    expect(regionFromLocale('ja')).toBe('JP');
  });

  it('returns undefined for an invalid locale', () => {
    expect(regionFromLocale('not a locale!')).toBeUndefined();
  });
});

describe('defaultCurrencyForLocale', () => {
  it.each([
    ['en-IN', 'INR'],
    ['hi', 'INR'],
    ['en-US', 'USD'],
    ['en-GB', 'GBP'],
    ['de-DE', 'EUR'],
    ['fr-FR', 'EUR'],
    ['ja-JP', 'JPY'],
    ['ar-KW', 'KWD'],
    ['de-CH', 'CHF'],
  ])('%s defaults to %s', (locale, currency) => {
    expect(defaultCurrencyForLocale(locale, supported)).toBe(currency);
  });

  it('falls back to USD when the region currency is not supported', () => {
    expect(defaultCurrencyForLocale('pt-BR', supported)).toBe('USD');
  });

  it('falls back to USD for an invalid locale', () => {
    expect(defaultCurrencyForLocale('???', supported)).toBe('USD');
  });
});
