import { useMemo } from 'react';
import { useCurrencies, useProfile } from '@/features/profile/api';

export type MoneyContext = {
  baseCurrency: string;
  /** ISO 4217 exponent for a currency code (2 if unknown). */
  exponentOf: (code: string) => number;
  currencies: ReadonlyArray<{ code: string; name: string; exponent: number }>;
};

/**
 * Base currency and currency exponents for formatting and conversion. Only used below
 * RequireOnboarded, so the profile has a base currency. Null while currencies load.
 */
export function useMoney(): MoneyContext | null {
  const baseCurrency = useProfile().data?.base_currency;
  const { data: currencies } = useCurrencies();

  return useMemo(() => {
    if (!baseCurrency || !currencies) return null;
    const exponents = new Map(currencies.map((c) => [c.code, c.exponent]));
    return {
      baseCurrency,
      exponentOf: (code: string) => exponents.get(code) ?? 2,
      currencies,
    };
  }, [baseCurrency, currencies]);
}
